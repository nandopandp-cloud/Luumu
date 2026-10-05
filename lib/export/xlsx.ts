import "server-only";
import ExcelJS from "exceljs";
import type { ExportRow } from "@/lib/db/responses";

const LUUMU_ROXO = "FF6B2BD9";
const LUUMU_LAVANDA = "FFF3EDFF";

/** Gera uma planilha .xlsx formatada com a identidade Luumu. */
export async function toXlsx(rows: ExportRow[], title: string): Promise<Buffer> {
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
    { header: "Respondente", key: "respondent", width: 22 },
    { header: "Canal", key: "channel", width: 12 },
    { header: "Sentimento", key: "sentiment", width: 14 },
    { header: "Nota", key: "score", width: 8 },
    { header: "Comentário", key: "comment", width: 50 },
    { header: "Data", key: "createdAt", width: 20 },
  ];

  // cabeçalho com a cor da marca
  const header = ws.getRow(1);
  header.height = 22;
  header.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LUUMU_ROXO } };
    c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    c.alignment = { vertical: "middle", horizontal: "left" };
  });

  rows.forEach((r, i) => {
    const row = ws.addRow({
      id: r.id,
      surveyName: r.surveyName,
      respondent: r.respondent,
      channel: r.channel,
      sentiment: r.sentiment,
      score: r.score ?? "",
      comment: r.comment,
      createdAt: r.createdAt,
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

  ws.autoFilter = { from: "A1", to: "H1" };

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
