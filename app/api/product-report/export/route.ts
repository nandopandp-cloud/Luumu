import { NextResponse } from "next/server";
import { productReportApiSession } from "@/lib/product-report/access";
import { getGeneratedReport, listGeneratedReports } from "@/lib/db/product-report";
import { getUserById } from "@/lib/db/users";
import { reportStatus, type ReportStatus } from "@/lib/product-report/html";
import { loadReportModel } from "@/lib/product-report/load";
import { parsePeriod } from "@/lib/product-report/period";
import { renderReportHtml } from "@/lib/product-report/render-html";
import { renderReportPdf } from "@/lib/product-report/render-pdf";
import type { ReportModel } from "@/lib/product-report/model";

export const dynamic = "force-dynamic";
// pdfkit precisa do runtime Node (não Edge)
export const runtime = "nodejs";

/**
 * GET /api/product-report/export?format=html|pdf&period=AAAA-MM-Q   (estado atual da quinzena)
 * GET /api/product-report/export?format=html|pdf&report=prr_...      (relatório gerado, congelado)
 * &download=1 baixa o HTML em vez de abrir. Só a conta autorizada do módulo; qualquer outra
 * sessão (ou nenhuma) recebe 404, igual a uma rota que não existe.
 */
export async function GET(req: Request) {
  const session = await productReportApiSession();
  if (!session) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") === "pdf" ? "pdf" : "html";
  const reportId = searchParams.get("report");
  const period = searchParams.get("period");

  let model: ReportModel;
  let generatedAt: string;
  let status: ReportStatus;
  if (reportId) {
    // o workspace no filtro impede ler relatório de outro workspace pelo id
    const run = await getGeneratedReport(session.workspaceId, reportId);
    if (!run) return NextResponse.json({ error: "Relatório não encontrado." }, { status: 404 });
    model = (run.data as { model: ReportModel }).model;
    generatedAt = run.createdAt.toISOString();
    status = "concluido";
  } else {
    if (!parsePeriod(period)) return NextResponse.json({ error: "Quinzena inválida." }, { status: 400 });
    const [me, reports] = await Promise.all([getUserById(session.userId), listGeneratedReports(session.workspaceId)]);
    model = await loadReportModel(session.workspaceId, period!, { author: me ? { name: me.name, avatarUrl: me.avatarUrl } : null });
    generatedAt = new Date().toISOString();
    status = reportStatus(model.closed, reports.some((r) => r.period === period));
  }

  const base = `report-quinzenal-produto-${model.period}`;
  const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

  if (format === "pdf") {
    const buf = await renderReportPdf(model, { generatedAt, status });
    return new NextResponse(new Uint8Array(buf), {
      headers: { ...headers, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${base}.pdf"` },
    });
  }
  const html = renderReportHtml(model, { generatedAt, status });
  return new NextResponse(html, {
    headers: {
      ...headers,
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `${searchParams.get("download") === "1" ? "attachment" : "inline"}; filename="${base}.html"`,
    },
  });
}
