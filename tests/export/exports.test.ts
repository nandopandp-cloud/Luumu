/*
  Exportação (Compartilhar do Analytics e Respostas): PDF sem páginas em branco, tabelas do
  Analytics em português e os três formatos a partir das mesmas tabelas.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { toPdf, tablesToPdf } from "../../lib/export/pdf";
import { tablesToCsv } from "../../lib/export/csv";
import { tablesToXlsx } from "../../lib/export/xlsx";
import { analyticsTables, fmtBucket, fmtDuration, usersTable } from "../../lib/analytics/export";
import type { AnalyticsData } from "../../lib/db/analytics";

const pages = (buf: Buffer) => (buf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length;

test("PDF de respostas: o rodapé não cria páginas em branco", async () => {
  const row = (i: number) => ({ id: `r${i}`, surveyName: "CSAT", name: "", respondent: `a${i}@x.com`, channel: "web", sentiment: "positivo", score: 5, comment: "Gostei", createdAt: new Date() });
  // antes da correção: 90 linhas (3 páginas de conteúdo) viravam 6 páginas
  const buf = await toPdf(Array.from({ length: 90 }, (_, i) => row(i)) as never, { title: "T", summary: { total: 90, avgScore: 4, positivePct: 80 } });
  assert.equal(pages(buf), 3);
  assert.equal(pages(await toPdf([], { title: "T", summary: { total: 0, avgScore: null, positivePct: 0 } })), 1);
});

test("PDF de tabelas: só as páginas que o conteúdo ocupa", async () => {
  const small = [{ title: "A", columns: ["x", "y"], rows: [["a", 1]] }];
  assert.equal(pages(await tablesToPdf(small, { title: "T" })), 1);
  const big = [{ title: "Usuários", columns: ["Nome", "Sessões"], rows: Array.from({ length: 120 }, (_, i) => [`Aluno ${i}`, i]) }];
  const n = pages(await tablesToPdf(big, { title: "T" }));
  assert.ok(n >= 3 && n <= 4, `páginas: ${n}`);
  // 12 colunas: paisagem, uma linha por registro
  const wide = [{ title: "U", columns: Array.from({ length: 12 }, (_, i) => `Col ${i}`), rows: Array.from({ length: 60 }, () => Array.from({ length: 12 }, () => "texto bem comprido que não cabe na coluna")) }];
  assert.ok(pages(await tablesToPdf(wide, { title: "T" })) <= 3);
});

const data: AnalyticsData = {
  daily: { cur: [{ d: "2026-10-05", users: 10, sessions: 12, ms: 125_000, pv: 40 }], prev: [{ d: "2026-10-04", users: 8, sessions: 9, ms: 60_000, pv: 30 }] },
  totals: { users: 10, users_prev: 8, sessions: 12, sessions_prev: 9, pv: 40, pv_prev: 30, ms: 125_000, ms_prev: 60_000, mau: 50, mau_prev: 40, identified: 7 } as never,
  pages: [{ host: "squad.jovensgenios.com", path: "inicio", pv: 30, users: 9, ms: 61_000 }],
  devices: [{ device: "mobile", users: 4, sessions: 5, ms: 30_000 }],
  frequency: { daily: 1, weekly: 2, monthly: 0, sporadic: 7 },
};

test("tabelas do Analytics: KPIs + uma tabela por consulta, sem repetir", () => {
  const t = analyticsTables(data, ["kpi_dau", "kpi_mau", "kpi_session_time", "users_trend", "session_time", "top_pages", "devices", "device_time", "frequency"]);
  assert.deepEqual(t.map((x) => x.title), ["Indicadores", "Uso por dia", "Páginas mais acessadas", "Dispositivos", "Frequência de uso"]);
  assert.deepEqual(t[0].rows[0].slice(1), [10, "+25%"]); // DAU 10 vs 8
  assert.equal(t[0].rows[2][1], "2m 05s");
  assert.deepEqual(t[2].rows[0], ["squad.jovensgenios.com", "/inicio", 30, 9, "1m 01s"]);
  assert.equal(t[3].rows[0][0], "Celular");
  assert.deepEqual(t[4].rows.map((r) => r[0]), ["Diário", "Semanal", "Mensal", "Esporádico"]);
});

test("duração legível", () => {
  assert.equal(fmtDuration(0), "0m 00s");
  assert.equal(fmtDuration(3_725_000), "1h 02m");
  assert.equal(fmtDuration(null), "");
  assert.equal(fmtBucket("2026-10-05T07"), "05/10 07h");
  assert.equal(fmtBucket("2026-10-05"), "05/10/2026");
});

test("CSV e XLSX das mesmas tabelas", async () => {
  const tables = [
    usersTable([{ anonId: "a1", userId: "u1", email: "ana@x.com", name: "Ana Souza", avatar: null, firstSeenAt: "2026-10-01T12:00:00Z", lastSeenAt: "2026-10-05T12:00:00Z", channel: "direct", landing: "inicio", device: "desktop", os: "Mac", browser: "Chrome", sessions: 2, pageviews: 30, ms: 600_000, days: 2, events: 5 }]),
    { title: "Indicadores", columns: ["Indicador", "Valor"], rows: [["DAU", 10]] },
  ];
  const csv = tablesToCsv(tables).toString("utf8");
  assert.ok(csv.startsWith("﻿Usuários\r\nNome,E-mail"));
  assert.ok(csv.includes("Ana Souza,ana@x.com,u1"));
  assert.ok(csv.includes("\r\n\r\nIndicadores\r\nIndicador,Valor\r\nDAU,10"));

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await tablesToXlsx(tables, "T")) as never);
  assert.deepEqual(wb.worksheets.map((w) => w.name), ["Usuários", "Indicadores"]);
  assert.equal(wb.getWorksheet("Usuários")!.getRow(2).getCell(1).value, "Ana Souza");
});
