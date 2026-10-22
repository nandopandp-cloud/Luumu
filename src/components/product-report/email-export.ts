/*
  Report para colar no corpo do e-mail. Roda no navegador: os gráficos viram PNG (canvas) porque
  Gmail e Outlook não mostram SVG; o resto é a tabela de lib/product-report/render-email.ts.
*/
import { buildCharts, CARD, chartCardSvg } from "@/lib/product-report/charts";
import { renderEmailHtml } from "@/lib/product-report/render-email";
import type { ReportModel } from "@/lib/product-report/model";
import type { ReportStatus } from "@/lib/product-report/html";

/** SVG → PNG (data URL) em 2x, nítido em telas retina. */
async function svgToPng(svg: string, w: number, h: number, scale = 2): Promise<string> {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/png");
}

export async function buildEmailHtml(model: ReportModel, status: ReportStatus): Promise<string> {
  const charts = buildCharts(model);
  const images = await Promise.all(charts.map((c) => svgToPng(chartCardSvg(c), CARD.W, CARD.H)));
  return renderEmailHtml(model, { status, generatedAt: new Date().toISOString(), chartImages: Object.fromEntries(charts.map((c, i) => [c.id, images[i]])) });
}

/**
 * Copia como conteúdo formatado (text/html): colando no Gmail/Outlook entra com layout e imagens.
 * Devolve false se o navegador não permitir (aí a tela oferece abrir a versão para copiar à mão).
 */
export async function copyRichHtml(html: string, plain: string): Promise<boolean> {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) return false;
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plain], { type: "text/plain" }),
      }),
    ]);
    return true;
  } catch {
    return false;
  }
}

/** Página só com o e-mail, para abrir e copiar com Ctrl/Cmd+A, Ctrl/Cmd+C (ou salvar). */
export function emailDocument(html: string, title: string): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${title.replace(/</g, "&lt;")}</title></head><body style="margin:0;padding:24px;background:#ffffff">${html}</body></html>`;
}
