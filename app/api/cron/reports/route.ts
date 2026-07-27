import { NextResponse } from "next/server";
import {
  listDueScheduledReports,
  markScheduledReportRun,
  type Frequency,
} from "@/lib/db/reports";
import { listResponsesForExport, type Scope } from "@/lib/db/responses";
import { buildReportSnapshot } from "@/lib/db/report-snapshot";
import { getSurvey } from "@/lib/db/surveys";
import { periodToDateFrom } from "@/lib/period";
import { toCsv } from "@/lib/export/csv";
import { toXlsx } from "@/lib/export/xlsx";
import { toPdf } from "@/lib/export/pdf";
import { sendEmail } from "@/lib/email";
import { reportEmailHtml } from "@/lib/email-templates";

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
  const results: { id: string; ok: boolean; error?: string }[] = [];

  for (const report of due) {
    try {
      const surveyIds = (report.surveyIds as string[]) ?? [];
      // um agendamento pode cobrir várias pesquisas; se >1, exportamos consolidado do projeto
      const singleSurveyId = surveyIds.length === 1 ? surveyIds[0] : undefined;
      const survey = singleSurveyId ? await getSurvey(singleSurveyId, { projectId: report.projectId }) : null;

      const scope: Scope = {
        projectId: report.projectId,
        surveyId: singleSurveyId,
        dateFrom: periodToDateFrom(report.period),
      };

      const [snapshot, rows] = await Promise.all([
        buildReportSnapshot({
          projectId: report.projectId,
          surveyId: singleSurveyId,
          surveyName: survey?.name ?? null,
          period: report.period,
        }),
        listResponsesForExport(scope),
      ]);

      // gera o anexo no formato escolhido
      const scopeName = snapshot.scopeName;
      const dateTag = new Date().toISOString().slice(0, 10);
      const base = `luumu-relatorio-${dateTag}`;
      let attachment: { filename: string; content: Buffer } | undefined;

      if (report.format === "csv") {
        attachment = { filename: `${base}.csv`, content: toCsv(rows) };
      } else if (report.format === "xlsx") {
        attachment = { filename: `${base}.xlsx`, content: await toXlsx(rows, scopeName) };
      } else {
        attachment = {
          filename: `${base}.pdf`,
          content: await toPdf(rows, {
            title: `Relatório de respostas: ${scopeName}`,
            summary: { total: snapshot.total, avgScore: null, positivePct: snapshot.positivePct },
          }),
        };
      }

      const html = reportEmailHtml({
        reportName: report.name,
        scopeName,
        periodLabel: snapshot.periodLabel,
        total: snapshot.total,
        scoreLabel: snapshot.scoreLabel,
        scoreValue: snapshot.scoreValue,
        positivePct: snapshot.positivePct,
        publicUrl: null,
        hasAttachment: true,
      });

      const sent = await sendEmail({
        to: (report.recipients as string[]) ?? [],
        subject: `${report.name} · ${scopeName}`,
        html,
        attachments: [attachment],
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
