import "server-only";
// mesmo build do pdfkit de lib/export/pdf.ts (o standalone embute as fontes; ver comentário lá)
import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import { drawFooters } from "@/lib/export/pdf";
import { formatCompact, type GoalStatus } from "./indicators";
import type { ReportModel } from "./model";
import { buildCharts, layoutChart, REF_COLOR, SERIES_COLOR, type ChartSpec, type Prim } from "./charts";
import { formatLongTs, introText, REPORT_STATUS, type ReportStatus } from "./html";
import { GROUP_STYLE, rowName } from "./render-html";

/*
  PDF do Report Quinzenal no layout do report de referência (A4 retrato): os mesmos blocos e
  números do HTML (render-html.ts). Os gráficos vêm das mesmas primitivas do SVG (charts.ts).
*/

const TXT = "#1a1a2e";
const MUT = "#6b7280";
const LINE = "#E5E7EB";
const BORDER = "#ECECF2";
const MARGIN = 36;

/**
 * As fontes padrão do PDF (Helvetica, codificação WinAnsi) só têm Latin-1 e alguns extras:
 * qualquer outro caractere embaralha a linha inteira. O sinal de menos vira hífen e o resto que
 * não existe na fonte (emoji, símbolos) sai do PDF; o HTML mantém o texto original.
 */
export function pdfText(s: string): string {
  return s.replace(/−/g, "-").replace(/[^\u0000-ÿ€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/gu, "");
}

type Doc = PDFKit.PDFDocument;
const contentW = (doc: Doc) => doc.page.width - MARGIN * 2;

function ensureSpace(doc: Doc, h: number) {
  if (doc.y + h > doc.page.height - MARGIN - 18) {
    doc.addPage({ size: "A4", margin: MARGIN });
    doc.y = MARGIN;
  }
}

function text(doc: Doc, s: string, x: number, y: number, o: { size: number; color?: string; bold?: boolean; width?: number; align?: "left" | "center" | "right"; lineBreak?: boolean }) {
  doc
    .font(o.bold ? "Helvetica-Bold" : "Helvetica")
    .fontSize(o.size)
    .fillColor(o.color ?? TXT)
    .text(pdfText(s), x, y, { width: o.width, align: o.align ?? "left", lineBreak: o.lineBreak ?? false });
}

/* ---------- ícones da coluna Resultado ---------- */

function resultIcon(doc: Doc, status: GoalStatus, cx: number, cy: number) {
  if (status === "met") {
    doc.roundedRect(cx - 6, cy - 6, 12, 12, 2).fill("#22C55E");
    doc.moveTo(cx - 3.2, cy + 0.2).lineTo(cx - 1, cy + 2.6).lineTo(cx + 3.4, cy - 2.4).lineWidth(1.6).lineCap("round").lineJoin("round").strokeColor("#fff").stroke();
  } else if (status === "missed") {
    doc.moveTo(cx - 4, cy - 4).lineTo(cx + 4, cy + 4).moveTo(cx + 4, cy - 4).lineTo(cx - 4, cy + 4).lineWidth(1.8).lineCap("round").strokeColor("#EF4444").stroke();
  } else text(doc, "—", cx - 10, cy - 4, { size: 9, color: MUT, width: 20, align: "center" });
}

/* ---------- 1. Resumo dos Indicadores ---------- */

function summaryTable(doc: Doc, g: ReportModel["groups"][number], code: string) {
  const st = GROUP_STYLE[g.key];
  const rows = g.key === "produto" ? g.rows.filter((r) => r.key === "northstar") : g.rows;
  const w = contentW(doc);
  const cols = [0.22, 0.19, 0.19, 0.25, 0.15].map((f) => f * w);
  const colX = cols.map((_, i) => MARGIN + cols.slice(0, i).reduce((a, c) => a + c, 0));
  const band = 20;
  const head = 22;
  const rowH = 22;
  const h = band + head + rows.length * rowH;
  ensureSpace(doc, h + 12);
  const y0 = doc.y;

  doc.save();
  doc.roundedRect(MARGIN, y0, w, h, 7).clip();
  doc.rect(MARGIN, y0, w, band).fill(st.color);
  doc.rect(MARGIN, y0 + band, w, head).fill("#F3F4F6");
  doc.restore();
  text(doc, st.title, MARGIN, y0 + 6.5, { size: 8.5, bold: true, color: "#fff", width: w, align: "center" });

  const headers = ["Indicador", `Meta (${code})`, "Realizado", "Nova Meta (Próxima Quinzena)", "Resultado"];
  headers.forEach((t, i) => text(doc, t, colX[i] + (i === 0 ? 8 : 4), y0 + band + 7.5, { size: 7.2, bold: true, width: cols[i] - (i === 0 ? 16 : 8), align: i === 0 ? "left" : "center" }));

  rows.forEach((r, idx) => {
    const y = y0 + band + head + idx * rowH;
    doc.moveTo(MARGIN, y).lineTo(MARGIN + w, y).lineWidth(0.6).strokeColor(LINE).stroke();
    const cells = [rowName(r), formatCompact(r.target, r.unit), formatCompact(r.value, r.unit), formatCompact(r.nextTarget, r.unit)];
    cells.forEach((c, i) => text(doc, c, colX[i] + 8, y + 7.5, { size: 8.5, width: cols[i] - 16, align: i === 0 ? "left" : "center" }));
    resultIcon(doc, r.status, colX[4] + cols[4] / 2, y + rowH / 2);
  });
  // divisórias verticais (abaixo da faixa) e borda colorida
  for (let i = 1; i < cols.length; i++) doc.moveTo(colX[i], y0 + band).lineTo(colX[i], y0 + h).lineWidth(0.6).strokeColor(LINE).stroke();
  doc.roundedRect(MARGIN, y0, w, h, 7).lineWidth(1).strokeColor(st.color).strokeOpacity(0.45).stroke().strokeOpacity(1);
  doc.y = y0 + h + 10;
}

/* ---------- 2. Evolução dos Indicadores ---------- */

function drawPrims(doc: Doc, prims: Prim[], ox: number, oy: number) {
  for (const p of prims) {
    if (p.t === "line" || p.t === "path") {
      const pts = p.t === "line" ? ([[p.x1, p.y1], [p.x2, p.y2]] as [number, number][]) : p.pts;
      pts.forEach(([x, y], i) => (i === 0 ? doc.moveTo(ox + x, oy + y) : doc.lineTo(ox + x, oy + y)));
      if (p.dash) doc.dash(p.dash[0] * 0.7, { space: p.dash[1] * 0.7 });
      doc.lineWidth(p.width).lineJoin("round").strokeColor(p.color).stroke();
      if (p.dash) doc.undash();
    } else if (p.t === "circle") {
      doc.circle(ox + p.cx, oy + p.cy, p.r).fill(p.fill);
      if (p.stroke) doc.circle(ox + p.cx, oy + p.cy, p.r).lineWidth(0.6).strokeColor(p.stroke).stroke();
    } else if (p.t === "rect") {
      doc.roundedRect(ox + p.x, oy + p.y, p.w, p.h, p.r).fill(p.fill);
    } else {
      doc.font(p.bold ? "Helvetica-Bold" : "Helvetica").fontSize(p.size);
      const s = pdfText(p.text);
      const w = doc.widthOfString(s);
      const x = p.anchor === "middle" ? p.x - w / 2 : p.anchor === "end" ? p.x - w : p.x;
      // y das primitivas é a linha de base (SVG); o pdfkit posiciona pelo topo
      doc.fillColor(p.color).text(s, ox + x, oy + p.y - p.size * 0.78, { lineBreak: false });
    }
  }
}

function chartCard(doc: Doc, spec: ChartSpec, x: number, y: number, w: number, h: number) {
  doc.roundedRect(x, y, w, h, 7).lineWidth(0.8).strokeColor(BORDER).stroke();
  const pad = 9;
  // etiqueta
  doc.font("Helvetica-Bold").fontSize(7.5);
  const tagW = doc.widthOfString(pdfText(spec.tag)) + 10;
  doc.roundedRect(x + pad, y + pad, tagW, 13, 2).fill(spec.tagColor);
  text(doc, spec.tag, x + pad + 5, y + pad + 3.2, { size: 7.5, bold: true, color: "#fff" });
  // médias (canto direito)
  let right = x + w - pad;
  for (const s of [...spec.stats].reverse()) {
    doc.font("Helvetica-Bold").fontSize(9);
    const vw = Math.max(doc.widthOfString(pdfText(s.value)), 30);
    right -= vw;
    text(doc, s.label, right, y + pad, { size: 5.5, color: MUT, width: vw + 8 });
    text(doc, s.value, right, y + pad + 7, { size: 9, bold: true, color: s.kind === "value" ? SERIES_COLOR : "#374151" });
    const cx = right - 8;
    const cy = y + pad + 8;
    if (s.kind === "value") {
      // círculo azul com a gota branca, como na referência
      doc.circle(cx, cy, 6).fill(SERIES_COLOR);
      doc.path(`M ${cx} ${cy - 3.6} C ${cx + 3} ${cy - 0.4} ${cx + 3} ${cy + 3} ${cx} ${cy + 3} C ${cx - 3} ${cy + 3} ${cx - 3} ${cy - 0.4} ${cx} ${cy - 3.6} Z`).fill("#fff");
    } else {
      // medalha: círculo duplo com fita
      doc.circle(cx, cy - 1, 3.6).lineWidth(0.8).strokeColor(MUT).stroke();
      doc.circle(cx, cy - 1, 1.4).lineWidth(0.8).strokeColor(MUT).stroke();
      doc.moveTo(cx - 2.2, cy + 2).lineTo(cx - 3, cy + 6).lineTo(cx, cy + 4.5).lineTo(cx + 3, cy + 6).lineTo(cx + 2.2, cy + 2).lineWidth(0.8).strokeColor(MUT).stroke();
    }
    right -= 24;
  }
  // título: abaixo da linha da etiqueta e das médias, usa a largura toda
  text(doc, spec.title, x + pad, y + pad + 19, { size: 7.5, bold: true, width: w - pad * 2, lineBreak: false });
  let top = y + pad + 30;
  if (spec.subtitle) {
    text(doc, spec.subtitle, x, top - 2, { size: 6, color: MUT, width: w, align: "center" });
    top += 6;
  }
  const plotH = h - (top - y) - 20;
  drawPrims(doc, layoutChart(spec, w - pad * 2, plotH, 5.6), x + pad, top);
  // legenda
  const items = [{ label: spec.seriesLabel, dash: undefined as [number, number] | undefined }, ...spec.refs.map((r) => ({ label: r.label, dash: r.dash }))];
  doc.font("Helvetica").fontSize(6);
  const widths = items.map((it) => doc.widthOfString(pdfText(it.label)) + 22);
  let lx = x + (w - widths.reduce((a, b) => a + b + 8, -8)) / 2;
  const ly = y + h - 12;
  items.forEach((it, i) => {
    doc.moveTo(lx, ly + 3).lineTo(lx + 14, ly + 3);
    if (it.dash) doc.dash(3, { space: 2 });
    doc.lineWidth(it.dash ? 0.9 : 1.4).strokeColor(it.dash ? REF_COLOR : SERIES_COLOR).stroke();
    doc.undash();
    if (!it.dash) doc.rect(lx + 5, ly + 0.8, 4.4, 4.4).fill(SERIES_COLOR);
    text(doc, it.label, lx + 18, ly, { size: 6, color: MUT });
    lx += widths[i] + 8;
  });
}

export function renderReportPdf(m: ReportModel, opts: { generatedAt: string; status: ReportStatus }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: MARGIN, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const w = contentW(doc);

    // cabeçalho
    text(doc, "Luumu · Relatórios › Report Quinzenal", MARGIN, MARGIN, { size: 7.5, color: MUT });
    text(doc, "Report da Área - Gestão de Produto", MARGIN, MARGIN + 13, { size: 17, bold: true });
    const period = `Período: ${m.datesShort} (${m.code})`;
    text(doc, period, MARGIN, MARGIN + 37, { size: 10.5, color: "#374151" });
    doc.font("Helvetica").fontSize(10.5);
    const px = MARGIN + doc.widthOfString(pdfText(period)) + 8;
    const st = REPORT_STATUS[opts.status];
    doc.font("Helvetica-Bold").fontSize(7.5);
    const sw = doc.widthOfString(st.label) + 14;
    doc.roundedRect(px, MARGIN + 35, sw, 14, 7).fill(st.bg);
    text(doc, st.label, px, MARGIN + 38.5, { size: 7.5, bold: true, color: st.fg, width: sw, align: "center" });

    // mensagem de abertura
    const intro = introText(m);
    doc.font("Helvetica").fontSize(8.5);
    const introH = doc.heightOfString(pdfText(intro), { width: w - 70 });
    const cardY = MARGIN + 62;
    const cardH = Math.max(46, introH + 30);
    doc.roundedRect(MARGIN, cardY, w, cardH, 7).lineWidth(0.8).strokeColor(BORDER).stroke();
    const name = m.author?.name ?? "Gestão de Produto";
    doc.circle(MARGIN + 24, cardY + 22, 12).fill("#6B2BD9");
    text(doc, name.trim()[0]?.toUpperCase() ?? "G", MARGIN + 12, cardY + 17, { size: 10, bold: true, color: "#fff", width: 24, align: "center" });
    text(doc, name, MARGIN + 44, cardY + 11, { size: 9, bold: true });
    text(doc, formatLongTs(m.editedAt ?? opts.generatedAt), MARGIN, cardY + 11, { size: 7, color: MUT, width: w - 12, align: "right" });
    text(doc, intro, MARGIN + 44, cardY + 24, { size: 8.5, color: "#4B5563", width: w - 70, lineBreak: true });
    doc.y = cardY + cardH + 16;

    // 1. Resumo
    text(doc, "1. Resumo dos Indicadores", MARGIN, doc.y, { size: 11.5, bold: true });
    doc.y += 18;
    for (const g of m.groups) summaryTable(doc, g, m.code);

    // 2. Evolução: 2 gráficos por linha
    ensureSpace(doc, 230);
    doc.y += 6;
    text(doc, "2. Evolução dos Indicadores", MARGIN, doc.y, { size: 11.5, bold: true });
    doc.y += 18;
    const gap = 10;
    const cw = (w - gap) / 2;
    const ch = 196;
    const charts = buildCharts(m);
    for (let i = 0; i < charts.length; i += 2) {
      ensureSpace(doc, ch + gap);
      const y = doc.y;
      charts.slice(i, i + 2).forEach((c, j) => chartCard(doc, c, MARGIN + j * (cw + gap), y, cw, ch));
      doc.y = y + ch + gap;
    }

    // observações
    const notes = m.notes.trim() || "Sem observações registradas.";
    doc.font("Helvetica").fontSize(9);
    const nh = doc.heightOfString(pdfText(notes), { width: w - 44 });
    ensureSpace(doc, nh + 64);
    const oy = doc.y + 6;
    doc.roundedRect(MARGIN, oy, w, nh + 52, 7).lineWidth(0.8).strokeColor(BORDER).stroke();
    doc.circle(MARGIN + 18, oy + 17, 5.5).lineWidth(1).strokeColor(TXT).stroke();
    text(doc, "i", MARGIN + 14, oy + 13.3, { size: 7, bold: true, width: 8, align: "center" });
    text(doc, "Observações e conclusões executivas", MARGIN + 30, oy + 12.5, { size: 9.5, bold: true });
    doc.roundedRect(MARGIN + 12, oy + 30, w - 24, nh + 14, 5).lineWidth(0.6).strokeColor(LINE).stroke();
    text(doc, notes, MARGIN + 22, oy + 37, { size: 9, color: m.notes.trim() ? TXT : MUT, width: w - 44, lineBreak: true });
    doc.y = oy + nh + 62;

    ensureSpace(doc, 30);
    text(
      doc,
      `Gerado em ${formatLongTs(opts.generatedAt)}${m.sync.at ? ` · dados da Luumu atualizados em ${formatLongTs(m.sync.at)}` : ""} · NorthStar = soma de (realizado ÷ meta × peso) de CSAT (${m.weights.csat}), Aderência (${m.weights.adherence}) e Tempo de uso (${m.weights.usage}), com a média das plataformas.`,
      MARGIN,
      doc.y,
      { size: 6.5, color: MUT, width: w, lineBreak: true }
    );

    drawFooters(doc, `Report da Área - Gestão de Produto · ${m.code}`);
    doc.end();
  });
}
