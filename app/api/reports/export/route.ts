import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { listResponsesForExport, getStats } from "@/lib/db/responses";
import { getSurvey } from "@/lib/db/surveys";
import { toCsv } from "@/lib/export/csv";
import { toXlsx } from "@/lib/export/xlsx";
import { toPdf } from "@/lib/export/pdf";

export const dynamic = "force-dynamic";
// pdfkit/exceljs precisam do runtime Node (não Edge)
export const runtime = "nodejs";

function slugify(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "relatorio";
}

/**
 * GET /api/reports/export?format=csv|xlsx|pdf&surveyId=svy_...
 * Exporta as respostas reais do workspace (ou de uma pesquisa dele) no formato pedido.
 * Autenticado por sessão do painel.
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const format = (searchParams.get("format") || "csv").toLowerCase();
  const surveyId = searchParams.get("surveyId") || undefined;

  // se filtrou por pesquisa, precisa pertencer ao workspace
  let scopeName = "Todas as pesquisas";
  if (surveyId) {
    const survey = await getSurvey(surveyId, session.workspaceId);
    if (!survey) return NextResponse.json({ error: "Pesquisa não encontrada." }, { status: 404 });
    scopeName = survey.name;
  }

  const scope = { workspaceId: session.workspaceId, surveyId };
  const rows = await listResponsesForExport(scope);

  const dateTag = new Date().toISOString().slice(0, 10);
  const base = `luumu-${slugify(scopeName)}-${dateTag}`;

  if (format === "csv") {
    const buf = toCsv(rows);
    return fileResponse(buf, `${base}.csv`, "text/csv; charset=utf-8");
  }

  if (format === "xlsx") {
    const buf = await toXlsx(rows, scopeName);
    return fileResponse(
      buf,
      `${base}.xlsx`,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  }

  if (format === "pdf") {
    const stats = await getStats(scope);
    const buf = await toPdf(rows, {
      title: `Relatório de respostas — ${scopeName}`,
      summary: { total: stats.total, avgScore: stats.avgScore, positivePct: stats.positivePct },
    });
    return fileResponse(buf, `${base}.pdf`, "application/pdf");
  }

  return NextResponse.json({ error: "Formato inválido. Use csv, xlsx ou pdf." }, { status: 400 });
}

function fileResponse(buf: Buffer, filename: string, contentType: string) {
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
