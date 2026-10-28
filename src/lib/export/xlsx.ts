import "server-only";
import ExcelJS from "exceljs";
import type { ExportRow } from "@/lib/db/responses";
import type { QuestionStat } from "@/lib/db/question-breakdown";

const LUUMU_ROXO = "FF6B2BD9";
const LUUMU_LAVANDA = "FFF3EDFF";

function brandHeader(ws: ExcelJS.Worksheet) {
  const header = ws.getRow(1);
  header.height = 22;
  header.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LUUMU_ROXO } };
    c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    c.alignment = { vertical: "middle", horizontal: "left" };
  });
}

/**
 * Gera uma planilha .xlsx formatada com a identidade Luumu. Na exportação de uma pesquisa
 * (`byQuestion`), a aba de respostas ganha uma coluna por pergunta e uma aba "Por pergunta"
 * traz quantidade e percentual de cada nota/opção.
 */
export async function toXlsx(
  rows: ExportRow[],
  title: string,
  byQuestion?: { columns: string[]; stats: QuestionStat[] }
): Promise<Buffer> {
  const questionCols = byQuestion?.columns ?? [];
  const wb = new ExcelJS.Workbook();
  wb.creator = "Luumu";
  wb.created = new Date();

  wb.title = `Luumu: ${title}`;
  const ws = wb.addWorksheet("Respostas", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  ws.columns = [
    { header: "ID", key: "id", width: 16 },
    { header: "Pesquisa", key: "surveyName", width: 28 },
    { header: "Nome", key: "name", width: 24 },
    { header: "Respondente", key: "respondent", width: 30 },
    { header: "Canal", key: "channel", width: 12 },
    { header: "Sentimento", key: "sentiment", width: 14 },
    { header: "Nota", key: "score", width: 8 },
    { header: "Comentário", key: "comment", width: 50 },
    { header: "Data", key: "createdAt", width: 20 },
    ...questionCols.map((c, i) => ({ header: c, key: `q${i}`, width: Math.min(40, Math.max(12, c.length * 0.6)) })),
  ];

  // cabeçalho com a cor da marca
  brandHeader(ws);

  rows.forEach((r, i) => {
    const row = ws.addRow({
      id: r.id,
      surveyName: r.surveyName,
      name: r.name,
      respondent: r.respondent,
      channel: r.channel,
      sentiment: r.sentiment,
      score: r.score ?? "",
      comment: r.comment,
      createdAt: r.createdAt,
      ...Object.fromEntries(questionCols.map((_, j) => [`q${j}`, r.answers?.[j] ?? ""])),
    });
    row.getCell("createdAt").numFmt = "dd/mm/yyyy hh:mm";
    row.alignment = { vertical: "top", wrapText: false };
    // zebra
    if (i % 2 === 1) {
      row.eachCell((c) => {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LUUMU_LAVANDA } };
      });
    }
  });

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } };

  if (byQuestion?.stats.length) {
    const qs = wb.addWorksheet("Por pergunta", { views: [{ state: "frozen", ySplit: 1 }] });
    qs.columns = [
      { header: "Pergunta", key: "question", width: 60 },
      { header: "Nota / opção", key: "label", width: 22 },
      { header: "Quantidade", key: "count", width: 12 },
      { header: "Percentual", key: "pct", width: 12 },
      { header: "Respostas", key: "answered", width: 12 },
      { header: "Média", key: "avg", width: 10 },
    ];
    brandHeader(qs);
    byQuestion.stats.forEach((s, i) => {
      s.buckets.forEach((b, j) => {
        // nas pontas da escala, o rótulo dela ("1 (Discordo totalmente)")
        const end = j === 0 ? s.minLabel : j === s.buckets.length - 1 ? s.maxLabel : undefined;
        const row = qs.addRow({
          question: `P${s.number}: ${s.title}`,
          label: s.kind === "scale" && end ? `${b.label} (${end})` : b.label,
          count: b.count,
          pct: b.pct / 100,
          answered: s.answered,
          avg: s.avg ?? "",
        });
        row.getCell("pct").numFmt = "0.0%";
        // zebra por pergunta (não por linha): o bloco de cada pergunta fica legível
        if (i % 2 === 1) row.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LUUMU_LAVANDA } }));
      });
    });
    qs.autoFilter = { from: "A1", to: "F1" };
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/** Uma aba por tabela, com cabeçalho na cor da marca, zebra, filtro e largura pelo conteúdo. */
export async function tablesToXlsx(tables: { title: string; columns: string[]; rows: (string | number | null)[][] }[], title: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Luumu";
  wb.created = new Date();
  wb.title = `Luumu: ${title}`;
  const used = new Set<string>();
  for (const t of tables) {
    // nome de aba: até 31 caracteres, sem []:*?/\ e sem repetir
    const base = t.title.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 28) || "Dados";
    let name = base;
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base.slice(0, 26)} ${n}`;
    used.add(name.toLowerCase());
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = t.columns.map((c, i) => ({
      header: c,
      key: `c${i}`,
      width: Math.min(60, Math.max(10, c.length + 2, ...t.rows.slice(0, 200).map((r) => String(r[i] ?? "").length + 2))),
    }));
    const header = ws.getRow(1);
    header.height = 22;
    header.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LUUMU_ROXO } };
      c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      c.alignment = { vertical: "middle", horizontal: "left" };
    });
    t.rows.forEach((r, i) => {
      const row = ws.addRow(Object.fromEntries(t.columns.map((_, j) => [`c${j}`, r[j] ?? ""])));
      if (i % 2 === 1) row.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LUUMU_LAVANDA } }));
    });
    if (t.columns.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: t.columns.length } };
  }
  if (!tables.length) wb.addWorksheet("Dados");
  return Buffer.from(await wb.xlsx.writeBuffer());
}
