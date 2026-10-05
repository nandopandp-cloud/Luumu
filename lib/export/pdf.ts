import "server-only";
import fs from "node:fs";
import path from "node:path";
// standalone embute as métricas de fonte (.afm); evita ENOENT em ambiente bundled (Next/Turbopack)
import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import type { ExportRow } from "@/lib/db/responses";

const ROXO = "#6B2BD9";
const TXT = "#1a1a2e";
const MUT = "#6b7280";
const LINE = "#e7e5f0";
const LAVANDA = "#F3EDFF";

// logo oficial na horizontal (mascote + wordmark), a mesma usada na sidebar do produto.
// pdfkit.standalone tem seu próprio shim de Buffer (Buffer.isBuffer falha com Buffer real do
// Node), então a imagem precisa ir como data URI base64 em vez de Buffer/caminho de arquivo.
const LOGO_DATA_URI = `data:image/png;base64,${fs
  .readFileSync(path.join(process.cwd(), "public", "mascot", "logo-horizontal-dark.png"))
  .toString("base64")}`;

export interface PdfSummary {
  total: number;
  avgScore: number | null;
  positivePct: number;
}

const fmtDate = (d: Date) =>
  d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/*
  Numeração no rodapé de todas as páginas. O rodapé fica abaixo da margem inferior: com a margem
  intacta o pdfkit trata o texto como estouro e cria uma página nova (em branco) a cada rodapé.
*/
function drawFooters(doc: PDFKit.PDFDocument, label: string) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .fillColor(MUT)
      .font("Helvetica")
      .fontSize(8)
      .text(`Luumu · ${label} · página ${i + 1} de ${range.count}`, doc.page.margins.left, doc.page.height - 30, {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        align: "center",
        lineBreak: false,
      });
    doc.page.margins.bottom = bottom;
  }
}

/** Cabeçalho da marca (faixa lavanda, logo, data) + título e subtítulo. Devolve o y seguinte. */
function drawBrandHeader(doc: PDFKit.PDFDocument, title: string, subtitle?: string) {
  const pageW = doc.page.width;
  const left = doc.page.margins.left;
  const contentW = pageW - left - doc.page.margins.right;
  doc.rect(0, 0, pageW, 80).fill(LAVANDA);
  doc.image(LOGO_DATA_URI, left, 22, { height: 36 });
  doc.font("Helvetica").fontSize(9).fillColor(MUT).text(`Gerado em ${fmtDate(new Date())}`, left, 36, { width: contentW, align: "right" });
  doc.fillColor(TXT).font("Helvetica-Bold").fontSize(18).text(title, left, 100, { width: contentW });
  if (subtitle) {
    doc.moveDown(0.25);
    doc.font("Helvetica").fontSize(10).fillColor(MUT).text(subtitle, left, doc.y, { width: contentW });
  }
  doc.moveDown(0.6);
}

export interface PdfTable {
  title: string;
  columns: string[];
  rows: (string | number | null)[][];
}

/**
 * PDF de várias tabelas (exportação do Analytics): cada tabela com título, cabeçalho roxo,
 * zebra e quebra de página repetindo o cabeçalho. Larguras proporcionais ao conteúdo.
 */
export function tablesToPdf(tables: PdfTable[], opts: { title: string; subtitle?: string }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // tabela larga (lista de usuários) em paisagem
    const layout = tables.some((t) => t.columns.length > 7) ? "landscape" : "portrait";
    const doc = new PDFDocument({ size: "A4", layout, margin: 40, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const contentW = right - left;
    const limit = () => doc.page.height - doc.page.margins.bottom - 20;
    const str = (v: string | number | null) => (v === null || v === "" ? "—" : typeof v === "number" ? v.toLocaleString("pt-BR") : v);

    drawBrandHeader(doc, opts.title, opts.subtitle);

    for (const t of tables) {
      // título + cabeçalho + 2 linhas precisam caber; senão a tabela começa na próxima página
      if (doc.y + 70 > limit()) {
        doc.addPage({ size: "A4", layout, margin: 40 });
        doc.y = doc.page.margins.top;
      }
      doc.fillColor(ROXO).font("Helvetica-Bold").fontSize(12).text(t.title, left, doc.y, { width: contentW });
      doc.moveDown(0.3);

      // cada coluna garante a largura do título; o espaço que sobra vai para quem tem mais texto
      doc.font("Helvetica-Bold").fontSize(7.5);
      const floor = t.columns.map((c) => doc.widthOfString(c.toUpperCase()) + 10);
      doc.font("Helvetica").fontSize(8);
      const sample = t.rows.slice(0, 50);
      const want = t.columns.map((_, i) => Math.min(220, Math.max(floor[i], ...sample.map((r) => doc.widthOfString(str(r[i] ?? null)) + 10))));
      const base = floor.reduce((a, w) => a + w, 0);
      const extra = want.map((w, i) => w - floor[i]);
      const extraSum = extra.reduce((a, w) => a + w, 0);
      const colW =
        base >= contentW
          ? floor.map((w) => (w / base) * contentW)
          : want.reduce((a, w) => a + w, 0) <= contentW
            ? want.map((w) => w * (contentW / want.reduce((a, x) => a + x, 0)))
            : floor.map((w, i) => w + (extraSum ? (extra[i] / extraSum) * (contentW - base) : 0));
      const colX = colW.map((_, i) => left + colW.slice(0, i).reduce((a, w) => a + w, 0));

      const header = () => {
        const y = doc.y;
        doc.rect(left, y, contentW, 18).fill(ROXO);
        doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(7.5);
        t.columns.forEach((c, i) => doc.text(c.toUpperCase(), colX[i] + 4, y + 5, { width: colW[i] - 8, height: 10, ellipsis: true, lineBreak: false }));
        doc.y = y + 18;
        doc.font("Helvetica").fontSize(8);
      };
      header();

      if (!t.rows.length) {
        doc.fillColor(MUT).text("Sem dados no período.", left + 4, doc.y + 5, { width: contentW - 8 });
        doc.y += 20;
      }
      t.rows.forEach((r, idx) => {
        const cells = t.columns.map((_, i) => str(r[i] ?? null));
        // uma linha por registro: o que não cabe é cortado com "…" (a planilha tem o texto inteiro)
        const rowH = 16;
        if (doc.y + rowH > limit()) {
          doc.addPage({ size: "A4", layout, margin: 40 });
          doc.y = doc.page.margins.top;
          header();
        }
        const y = doc.y;
        if (idx % 2 === 1) doc.rect(left, y, contentW, rowH).fill(LAVANDA);
        doc.fillColor(TXT);
        cells.forEach((c, i) => doc.text(c, colX[i] + 4, y + 4.5, { width: colW[i] - 8, height: 10, ellipsis: true, lineBreak: false }));
        doc.moveTo(left, y + rowH).lineTo(right, y + rowH).strokeColor(LINE).lineWidth(0.5).stroke();
        doc.y = y + rowH;
      });
      doc.y += 18;
    }

    drawFooters(doc, opts.title);
    doc.end();
  });
}

/** Gera um PDF profissional (Luumu) com sumário + tabela de respostas. */
export function toPdf(rows: ExportRow[], opts: { title: string; subtitle?: string; summary: PdfSummary }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageW = doc.page.width;
    const left = doc.page.margins.left;
    const right = pageW - doc.page.margins.right;
    const contentW = right - left;

    // ---------- Cabeçalho da marca ----------
    doc.rect(0, 0, pageW, 80).fill(LAVANDA);
    doc.image(LOGO_DATA_URI, left, 22, { height: 36 });
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(MUT)
      .text(`Gerado em ${fmtDate(new Date())}`, left, 36, { width: contentW, align: "right" });

    doc.y = 100;

    // ---------- Título do relatório ----------
    doc.fillColor(TXT).font("Helvetica-Bold").fontSize(18).text(opts.title, left, doc.y);
    // período coberto (a vigência da campanha, nos envios por tipo)
    if (opts.subtitle) {
      doc.moveDown(0.25);
      doc.font("Helvetica").fontSize(10).fillColor(MUT).text(opts.subtitle, left, doc.y);
    }
    doc.moveDown(0.4);

    // ---------- Cartões de resumo ----------
    const cardY = doc.y;
    const cardH = 58;
    const gap = 12;
    const cardW = (contentW - gap * 2) / 3;
    const cards = [
      { label: "Respostas", value: String(opts.summary.total) },
      { label: "Nota média", value: opts.summary.avgScore != null ? String(opts.summary.avgScore) : "—" },
      { label: "Sentimento positivo", value: `${opts.summary.positivePct}%` },
    ];
    cards.forEach((c, i) => {
      const x = left + i * (cardW + gap);
      doc.roundedRect(x, cardY, cardW, cardH, 8).fill(LAVANDA);
      doc.fillColor(MUT).font("Helvetica").fontSize(8).text(c.label.toUpperCase(), x + 12, cardY + 10, { width: cardW - 24 });
      doc.fillColor(ROXO).font("Helvetica-Bold").fontSize(22).text(c.value, x + 12, cardY + 24, { width: cardW - 24 });
    });
    doc.y = cardY + cardH + 22;

    // ---------- Tabela ----------
    const cols = [
      { key: "createdAt", label: "Data", w: 0.16 },
      { key: "surveyName", label: "Pesquisa", w: 0.2 },
      { key: "respondent", label: "Respondente", w: 0.16 },
      { key: "score", label: "Nota", w: 0.08 },
      { key: "sentiment", label: "Sentimento", w: 0.14 },
      { key: "comment", label: "Comentário", w: 0.26 },
    ] as const;
    const colX: number[] = [];
    let acc = left;
    for (const c of cols) {
      colX.push(acc);
      acc += c.w * contentW;
    }

    const drawHeader = () => {
      const y = doc.y;
      doc.rect(left, y, contentW, 20).fill(ROXO);
      doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8);
      cols.forEach((c, i) => {
        doc.text(c.label.toUpperCase(), colX[i] + 5, y + 6, { width: c.w * contentW - 8, ellipsis: true, lineBreak: false });
      });
      doc.y = y + 20;
    };

    drawHeader();

    const rowText = (r: ExportRow) => ({
      createdAt: fmtDate(r.createdAt),
      surveyName: r.surveyName,
      respondent: r.name || r.respondent,
      score: r.score != null ? String(r.score) : "—",
      sentiment: r.sentiment,
      comment: r.comment,
    });

    doc.font("Helvetica").fontSize(8);
    rows.forEach((r, idx) => {
      const t = rowText(r);
      // altura da linha guiada pelo comentário (campo mais longo)
      const commentW = cols[5].w * contentW - 8;
      const commentH = doc.heightOfString(t.comment || "—", { width: commentW });
      const rowH = Math.max(18, commentH + 8);

      // quebra de página
      if (doc.y + rowH > doc.page.height - doc.page.margins.bottom - 20) {
        doc.addPage();
        doc.y = doc.page.margins.top;
        drawHeader();
        doc.font("Helvetica").fontSize(8);
      }

      const y = doc.y;
      if (idx % 2 === 1) doc.rect(left, y, contentW, rowH).fill(LAVANDA);
      doc.fillColor(TXT);
      cols.forEach((c, i) => {
        const val = (t as Record<string, string>)[c.key] || (c.key === "comment" ? "—" : "");
        doc.text(val, colX[i] + 5, y + 4, {
          width: c.w * contentW - 8,
          ellipsis: c.key !== "comment",
          lineBreak: c.key === "comment",
          height: c.key === "comment" ? rowH - 8 : 12,
        });
      });
      doc.moveTo(left, y + rowH).lineTo(right, y + rowH).strokeColor(LINE).lineWidth(0.5).stroke();
      doc.y = y + rowH;
    });

    if (rows.length === 0) {
      doc.fillColor(MUT).font("Helvetica").fontSize(10).text("Nenhuma resposta no período selecionado.", left, doc.y + 10);
    }

    drawFooters(doc, "Relatório de respostas");
    doc.end();
  });
}
