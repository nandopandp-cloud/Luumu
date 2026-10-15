import "server-only";
// mesmo build do pdfkit de lib/export/pdf.ts (o standalone embute as fontes; ver comentário lá)
import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import { drawBrandHeader, drawFooters, drawPdfTable, type PdfTable } from "@/lib/export/pdf";
import { formatDelta, formatValue, METRIC_META, NORTH_STAR, type GoalKey } from "./indicators";
import type { IndicatorRow, ReportModel } from "./model";
import { periodShortLabel } from "./period";
import { STATUS_LABEL } from "./render-html";
import { chartDomain, segments, type ChartPoint } from "./svg-chart";

/*
  PDF do Report Quinzenal: as mesmas seções e números do HTML (render-html.ts), em A4 paisagem
  para as tabelas de 8 colunas caberem sem cortar.
*/

const ROXO = "#6B2BD9";
const TXT = "#1a1a2e";
const MUT = "#6b7280";
const LINE = "#e7e5f0";
const RED = "#dc2626";
const LAYOUT = "landscape" as const;

/**
 * As fontes padrão do PDF (Helvetica, codificação WinAnsi) só têm Latin-1 e alguns extras:
 * qualquer outro caractere embaralha a linha inteira. O sinal de menos vira hífen e o resto que
 * não existe na fonte (emoji, símbolos) sai do PDF; o HTML mantém o texto original.
 */
export function pdfText(s: string): string {
  return s.replace(/−/g, "-").replace(/[^\u0000-ÿ€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/gu, "");
}
const cell = (v: string | null) => (v === null ? null : pdfText(v));

const fmtTs = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
const target = (r: IndicatorRow, which: "target" | "next") => {
  const v = which === "target" ? r.target : r.nextTarget;
  const from = which === "target" ? r.targetFrom : r.nextTargetFrom;
  return `${formatValue(v, r.unit)}${from && v !== null ? ` (de ${periodShortLabel(from)})` : ""}`;
};

function ensureSpace(doc: PDFKit.PDFDocument, h: number) {
  if (doc.y + h > doc.page.height - doc.page.margins.bottom - 20) {
    doc.addPage({ size: "A4", layout: LAYOUT, margin: 40 });
    doc.y = doc.page.margins.top;
  }
}

function heading(doc: PDFKit.PDFDocument, text: string) {
  ensureSpace(doc, 60);
  doc.fillColor(ROXO).font("Helvetica-Bold").fontSize(12).text(text, doc.page.margins.left, doc.y);
  doc.moveDown(0.3);
}

function paragraph(doc: PDFKit.PDFDocument, text: string, opts: { color?: string; size?: number } = {}) {
  const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.fillColor(opts.color ?? TXT).font("Helvetica").fontSize(opts.size ?? 9.5).text(pdfText(text), doc.page.margins.left, doc.y, { width: w });
}

function drawChart(doc: PDFKit.PDFDocument, title: string, points: ChartPoint[], unit: "%" | "min" | "pts", x0: number, y0: number, w: number, h: number) {
  const m = { top: 18, right: 26, bottom: 18, left: 44 };
  const iw = w - m.left - m.right;
  const ih = h - m.top - m.bottom;
  const [lo, hi] = chartDomain(points);
  const x = (i: number) => x0 + m.left + (points.length <= 1 ? iw / 2 : (i * iw) / (points.length - 1));
  const y = (v: number) => y0 + m.top + ih - ((v - lo) / (hi - lo)) * ih;

  doc.roundedRect(x0, y0, w, h, 8).lineWidth(0.6).strokeColor(LINE).stroke();
  doc.fillColor(TXT).font("Helvetica-Bold").fontSize(9).text(title, x0 + 10, y0 + 6, { width: w - 20, lineBreak: false });

  doc.font("Helvetica").fontSize(7);
  for (let k = 0; k <= 3; k++) {
    const v = lo + ((hi - lo) * k) / 3;
    doc.moveTo(x0 + m.left, y(v)).lineTo(x0 + w - m.right, y(v)).lineWidth(0.4).strokeColor(LINE).stroke();
    doc.fillColor(MUT).text(formatValue(v, unit), x0 + 2, y(v) - 3, { width: m.left - 6, align: "right", lineBreak: false });
  }
  points.forEach((p, i) => doc.fillColor(MUT).text(p.label, x(i) - 25, y0 + h - 13, { width: 50, align: "center", lineBreak: false }));

  const step = points.length <= 1 ? iw / 2 : iw / (points.length - 1) / 2;
  for (const seg of segments(points.map((p) => p.target))) {
    doc.dash(3, { space: 3 });
    seg.forEach((i) => {
      const t = points[i].target as number;
      doc.moveTo(Math.max(x0 + m.left, x(i) - step), y(t)).lineTo(Math.min(x0 + w - m.right, x(i) + step), y(t));
    });
    doc.lineWidth(1).strokeColor("#9ca3af").stroke();
    doc.undash();
  }
  for (const seg of segments(points.map((p) => p.value))) {
    seg.forEach((i, k) => (k === 0 ? doc.moveTo(x(i), y(points[i].value as number)) : doc.lineTo(x(i), y(points[i].value as number))));
    doc.lineWidth(1.8).strokeColor(ROXO).stroke();
  }
  points.forEach((p, i) => {
    if (p.value === null) return;
    const below = p.target !== null && p.value < p.target;
    doc.circle(x(i), y(p.value), 2.6).fill(below ? RED : ROXO);
    doc.fillColor(TXT).font("Helvetica-Bold").fontSize(6.5).text(formatValue(p.value, unit), x(i) - 25, y(p.value) - 11, { width: 50, align: "center", lineBreak: false });
  });
  doc.font("Helvetica");
}

const EVOLUTION_ROWS: GoalKey[] = [NORTH_STAR, "ns.csat", "ns.adherence", "ns.usage"];

export function renderReportPdf(m: ReportModel, opts: { generatedAt: string }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: LAYOUT, margin: 40, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const title = "Report Quinzenal de Produto";
    // 1. título e período
    drawBrandHeader(doc, `1. ${title}`, `${m.label} (${m.dates})${m.closed ? "" : " · quinzena em andamento, resultados parciais"}`);

    if (m.alerts.length) {
      heading(doc, "Avisos sobre os dados");
      for (const a of m.alerts) paragraph(doc, `• ${a.text}`, { color: "#92400e", size: 8.5 });
      doc.moveDown(0.8);
    }

    // 2. Gestão de Produto
    const product: PdfTable = {
      title: "2. Gestão de Produto · North Star",
      columns: ["Indicador", "Peso", "Meta", "Realizado", "Normalizado", "Resultado", "Status", "Nova meta"],
      rows: [
        ...m.components.map((c) => [
          `${METRIC_META[c.metric].label} (${c.row.unit})`,
          String(c.weight),
          target(c.row, "target"),
          formatValue(c.value, c.row.unit),
          c.normalized === null ? null : c.normalized.toLocaleString("pt-BR", { maximumFractionDigits: 3 }),
          formatValue(c.result, "pts"),
          STATUS_LABEL[c.row.status],
          target(c.row, "next"),
        ]),
        [
          "NORTH STAR (soma)",
          String(m.components.reduce((a, c) => a + c.weight, 0)),
          target(m.northStar, "target"),
          formatValue(m.northStar.value, "pts"),
          null,
          formatValue(m.northStar.value, "pts"),
          STATUS_LABEL[m.northStar.status],
          target(m.northStar, "next"),
        ],
      ],
    };
    drawPdfTable(doc, { ...product, rows: product.rows.map((r) => r.map((c) => cell(c as string | null))) }, LAYOUT);
    if (m.northStar.prev !== null) {
      doc.y -= 12;
      paragraph(doc, `Quinzena anterior: ${formatValue(m.northStar.prev, "pts")} (${formatDelta(m.northStar.delta, "pts")}).`, { color: MUT, size: 8.5 });
      doc.moveDown(1);
    }

    // 3–5. plataformas
    m.groups.slice(1).forEach((g, i) =>
      drawPdfTable(
        doc,
        {
          title: `${i + 3}. ${g.title}`,
          columns: ["Indicador", "Meta", "Realizado", "Status", "Anterior", "Variação", "Nova meta", "Fonte"],
          rows: g.rows.map((r) => [
            `${METRIC_META[r.key.split(".")[1] as keyof typeof METRIC_META].label} (${r.unit})`,
            target(r, "target"),
            formatValue(r.value, r.unit),
            STATUS_LABEL[r.status],
            formatValue(r.prev, r.unit),
            formatDelta(r.delta, r.unit),
            target(r, "next"),
            r.source ? `${r.source}${r.detail ? ` · ${r.detail}` : ""}` : null,
          ].map(cell)),
        },
        LAYOUT
      )
    );

    // 6. evolução
    const allRows = m.groups.flatMap((g) => g.rows);
    const keys = [...EVOLUTION_ROWS, ...m.groups.slice(1).flatMap((g) => g.rows.map((r) => r.key))];
    drawPdfTable(
      doc,
      {
        title: "6. Evolução dos indicadores",
        columns: ["Indicador", ...m.history.map((h) => h.label)],
        rows: keys.map((k) => {
          const r = allRows.find((x) => x.key === k);
          const unit = r?.unit ?? "pts";
          return [r?.label ?? k, ...m.history.map((h) => formatValue(h.values[k] ?? null, unit))].map(cell);
        }),
      },
      LAYOUT
    );

    // 7. gráficos: 2 por linha
    heading(doc, "7. Gráficos históricos");
    paragraph(doc, "Linha roxa: realizado · tracejado: meta da quinzena · ponto vermelho: abaixo da meta.", { color: MUT, size: 8 });
    doc.moveDown(0.4);
    const charts: [GoalKey, string, "%" | "min" | "pts"][] = [
      [NORTH_STAR, "North Star", "pts"],
      ["ns.csat", "CSAT (média Exploradores e Educadores)", "%"],
      ["ns.adherence", "Aderência (média das plataformas)", "%"],
      ["ns.usage", "Tempo de uso (média das plataformas)", "min"],
    ];
    const cw = (doc.page.width - doc.page.margins.left - doc.page.margins.right - 14) / 2;
    const ch = 150;
    for (let i = 0; i < charts.length; i += 2) {
      ensureSpace(doc, ch + 10);
      const y0 = doc.y;
      charts.slice(i, i + 2).forEach(([key, t, unit], j) => {
        const points = m.history.map((h) => ({ label: h.label, value: h.values[key] ?? null, target: h.targets[key] ?? null }));
        drawChart(doc, t, points, unit, doc.page.margins.left + j * (cw + 14), y0, cw, ch);
      });
      doc.y = y0 + ch + 12;
    }
    doc.moveDown(0.6);

    // 8. comparação com as metas
    heading(doc, "8. Comparação com as metas");
    const all = m.groups.flatMap((g) => g.rows.map((r) => ({ ...r, group: g.title })));
    const line = (r: (typeof all)[number]) =>
      `• ${r.group} · ${r.label.replace(/ · .*$/, "")}: ${formatValue(r.value, r.unit)}${r.target !== null ? ` (meta ${formatValue(r.target, r.unit)})` : ""}`;
    const met = all.filter((r) => r.status === "met");
    const missed = all.filter((r) => r.status === "missed");
    const none = all.filter((r) => r.status === "no_data" || r.status === "no_target");
    paragraph(doc, "Atingiram a meta", { color: "#15803d", size: 9.5 });
    paragraph(doc, met.length ? met.map(line).join("\n") : "Nenhum.", { size: 9 });
    doc.moveDown(0.4);
    paragraph(doc, "Abaixo da meta", { color: "#b91c1c", size: 9.5 });
    paragraph(doc, missed.length ? missed.map(line).join("\n") : "Nenhum.", { size: 9 });
    if (none.length) {
      doc.moveDown(0.4);
      paragraph(doc, `Sem dado ou sem meta: ${none.map((r) => `${r.group} · ${r.label.replace(/ · .*$/, "")}`).join("; ")}.`, { color: MUT, size: 8.5 });
    }
    doc.moveDown(1);

    // 9. observações
    heading(doc, "9. Observações e conclusões executivas");
    paragraph(doc, m.notes.trim() || "Sem observações registradas.", { color: m.notes.trim() ? TXT : MUT });
    doc.moveDown(1);

    // 10. geração
    heading(doc, "10. Geração");
    paragraph(doc, `Gerado em ${fmtTs(opts.generatedAt)}${m.sync.at ? ` · dados da Luumu atualizados em ${fmtTs(m.sync.at)}` : " · sem atualização da Luumu nesta quinzena"}.`, { size: 9 });
    paragraph(
      doc,
      `North Star = soma de (realizado ÷ meta × peso) dos componentes CSAT (${m.weights.csat}), Aderência (${m.weights.adherence}) e Tempo de uso (${m.weights.usage}), com a média das plataformas; mesma fórmula da planilha North Star.`,
      { color: MUT, size: 8 }
    );

    drawFooters(doc, `${title} · ${m.label}`);
    doc.end();
  });
}
