import { NextResponse } from "next/server";
import {
  listDueScheduledReports,
  markScheduledReportRun,
  type Frequency,
} from "@/lib/db/reports";
import { listResponsesForExport, type Scope } from "@/lib/db/responses";
import { buildReportSnapshot } from "@/lib/db/report-snapshot";
import { getSurvey, findLatestEndedSurveyByType } from "@/lib/db/surveys";
import { periodToDateFrom } from "@/lib/period";
import { formatDate } from "@/lib/schedule";
import { toCsv } from "@/lib/export/csv";
import { toXlsx } from "@/lib/export/xlsx";
import { toPdf } from "@/lib/export/pdf";
import { sendEmail } from "@/lib/email";
import { reportEmailHtml } from "@/lib/email-templates";
import { getAppOrigin } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/cron/reports — processa os agendamentos de relatório que já venceram.
 * Chamado pelo Vercel Cron (1x/dia). Protegido pelo header Authorization com CRON_SECRET
 * (o Vercel Cron envia automaticamente `Authorization: Bearer <CRON_SECRET>`).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
  }

  const due = await listDueScheduledReports();
  const results: { id: string; ok: boolean; error?: string; skipped?: string }[] = [];

  for (const report of due) {
    try {
      const surveyTypes = (report.surveyTypes as string[]) ?? [];
      const surveyIds = (report.surveyIds as string[]) ?? [];

      /**
       * Alvos deste ciclo. No modo por tipo, cada alvo é a última campanha encerrada
       * daquele tipo, recortada pela própria vigência — assim o envio acompanha campanhas
       * que se sucedem sem reconfiguração. No modo clássico (surveyIds), mantém o
       * comportamento antigo: uma pesquisa nomeada, ou o consolidado do projeto.
       */
      const targets = surveyTypes.length > 0
        ? (await findLatestEndedSurveyByType(report.projectId, surveyTypes)).map((s) => ({
            surveyId: s.id as string | undefined,
            name: s.name,
            // o recorte é a vigência da campanha, não a janela "últimos N dias"
            dateFrom: s.startsAt ? new Date(`${s.startsAt}T00:00:00`) : undefined,
            dateTo: s.endsAt ? new Date(`${s.endsAt}T23:59:59.999`) : undefined,
            periodLabel: `${formatDate(s.startsAt)} a ${formatDate(s.endsAt)}`,
          }))
        : await (async () => {
            // um agendamento pode cobrir várias pesquisas; se >1, exportamos consolidado do projeto
            const singleSurveyId = surveyIds.length === 1 ? surveyIds[0] : undefined;
            const survey = singleSurveyId ? await getSurvey(singleSurveyId, { projectId: report.projectId }) : null;
            return [{
              surveyId: singleSurveyId,
              name: survey?.name ?? null,
              dateFrom: periodToDateFrom(report.period),
              dateTo: undefined as Date | undefined,
              periodLabel: null as string | null,
            }];
          })();

      if (targets.length === 0) {
        // nenhum ciclo fechado ainda para os tipos acompanhados: não há o que enviar.
        // Reagenda para tentar de novo no próximo ciclo, sem mandar e-mail vazio.
        await markScheduledReportRun(report.id, report.frequency as Frequency);
        results.push({ id: report.id, ok: true, skipped: "nenhuma campanha encerrada para os tipos acompanhados" });
        continue;
      }

      const dateTag = new Date().toISOString().slice(0, 10);
      const attachments: { filename: string; content: Buffer }[] = [];
      const parts: Awaited<ReturnType<typeof buildReportSnapshot>>[] = [];

      // um anexo por alvo: CSAT e SUS têm metodologias de score diferentes e não devem
      // ser somados num relatório só
      for (const target of targets) {
        const scope: Scope = {
          projectId: report.projectId,
          surveyId: target.surveyId,
          dateFrom: target.dateFrom,
          dateTo: target.dateTo,
        };

        const [snapshot, rows] = await Promise.all([
          buildReportSnapshot({
            projectId: report.projectId,
            surveyId: target.surveyId,
            surveyName: target.name,
            period: report.period,
            dateFrom: target.dateFrom,
            dateTo: target.dateTo,
            periodLabel: target.periodLabel ?? undefined,
          }),
          listResponsesForExport(scope),
        ]);
        parts.push(snapshot);

        const scopeName = snapshot.scopeName;
        const slug = scopeName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "relatorio";
        const base = `luumu-${slug}-${dateTag}`;

        if (report.format === "csv") {
          attachments.push({ filename: `${base}.csv`, content: toCsv(rows) });
        } else if (report.format === "xlsx") {
          attachments.push({ filename: `${base}.xlsx`, content: await toXlsx(rows, scopeName) });
        } else {
          attachments.push({
            filename: `${base}.pdf`,
            content: await toPdf(rows, {
              title: `Relatório de respostas: ${scopeName}`,
              subtitle: snapshot.periodLabel,
              summary: { total: snapshot.total, avgScore: null, positivePct: snapshot.positivePct },
            }),
          });
        }
      }

      // o corpo do e-mail resume o primeiro alvo; os demais vão como anexos adicionais
      const head = parts[0];
      const scopeName = parts.length > 1
        ? parts.map((p) => p.scopeName).join(" · ")
        : head.scopeName;

      const html = reportEmailHtml({
        reportName: report.name,
        scopeName,
        periodLabel: head.periodLabel,
        total: head.total,
        scoreLabel: head.scoreLabel,
        scoreValue: head.scoreValue,
        scoreFormula: head.scoreFormula,
        positivePct: head.positivePct,
        publicUrl: `${getAppOrigin()}/reports`,
        hasAttachment: true,
        attachmentFormat: report.format,
        appOrigin: getAppOrigin(),
      });

      const sent = await sendEmail({
        to: (report.recipients as string[]) ?? [],
        subject: `${report.name} · ${scopeName}`,
        html,
        attachments,
      });

      // reagenda mesmo se o e-mail foi "skipped" (sem RESEND_API_KEY) — evita reprocessar em loop
      await markScheduledReportRun(report.id, report.frequency as Frequency);
      results.push({ id: report.id, ok: sent.ok || !!sent.skipped, error: sent.error });
    } catch (e) {
      results.push({ id: report.id, ok: false, error: e instanceof Error ? e.message : "erro" });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
