import "server-only";
// standalone embute as métricas de fonte (.afm); evita ENOENT em ambiente bundled (Next/Turbopack)
import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import type { ExportRow } from "@/lib/db/responses";

const ROXO = "#6B2BD9";
const ROXO_ESCURO = "#4B1CAB";
const VERDE = "#7ED957";
const TXT = "#1a1a2e";
const MUT = "#6b7280";
const LINE = "#e7e5f0";
const LAVANDA = "#F3EDFF";

export interface PdfSummary {
  total: number;
  avgScore: number | null;
  positivePct: number;
}

const fmtDate = (d: Date) =>
  d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Gera um PDF profissional (Luumu) com sumário + tabela de respostas. */
export function toPdf(rows: ExportRow[], opts: { title: string; summary: PdfSummary }): Promise<Buffer> {
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
    doc.rect(0, 0, pageW, 90).fill(ROXO);
    // "mascote" simples (círculo roxo escuro + folha verde)
    doc.circle(left + 18, 45, 16).fill(ROXO_ESCURO);
    doc.circle(left + 12, 40, 3).fill("#ffffff");
    doc.circle(left + 22, 40, 3).fill("#ffffff");
    doc.polygon([left + 26, 30], [left + 40, 22], [left + 32, 36]).fill(VERDE);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(20).text("Luumu", left + 46, 30);
    doc.font("Helvetica").fontSize(9).fillColor("#e9dcff").text("Ouça. Entenda. Melhore.", left + 46, 54);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#e9dcff")
      .text(`Gerado em ${fmtDate(new Date())}`, left, 40, { width: contentW, align: "right" });

    doc.y = 110;

    // ---------- Título do relatório ----------
    doc.fillColor(TXT).font("Helvetica-Bold").fontSize(18).text(opts.title, left, doc.y);
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
      respondent: r.respondent,
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

    // ---------- Rodapé (numeração) ----------
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc
        .fillColor(MUT)
        .font("Helvetica")
        .fontSize(8)
        .text(
          `Luumu · Relatório de respostas · página ${i + 1} de ${range.count}`,
          left,
          doc.page.height - 30,
          { width: contentW, align: "center" }
        );
    }

    doc.end();
  });
}
