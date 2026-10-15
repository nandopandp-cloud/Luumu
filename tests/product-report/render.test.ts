import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReportModel, type SyncSnapshot } from "../../lib/product-report/model";
import { DEFAULT_WEIGHTS, formatCompact } from "../../lib/product-report/indicators";
import { renderReportHtml } from "../../lib/product-report/render-html";
import { pdfText, renderReportPdf } from "../../lib/product-report/render-pdf";
import { buildCharts, chartSvg, layoutChart, segments } from "../../lib/product-report/charts";
import { defaultIntro, reportStatus } from "../../lib/product-report/html";

const sync: SyncSnapshot = {
  createdAt: "2026-10-16T10:00:00.000Z",
  status: "ok",
  error: null,
  projects: {},
  values: {
    "educadores.adherence": { value: 64 }, "educadores.usage": { value: 13 }, "educadores.csat": { value: 86.5, detail: "120 respostas" },
    "exploradores.adherence": { value: 43.7 }, "exploradores.usage": { value: 5 }, "exploradores.csat": { value: 78.9 },
    "geniex.adherence": { value: 65 }, "geniex.usage": { value: 22 },
  },
};

const model = (notes = "Aderência subiu.\n<script>alert(1)</script>", intro = "") =>
  buildReportModel({
    period: "2026-10-1",
    stored: [
      { period: "2026-09-2", goals: { "ns.csat": 95, "ns.adherence": 50, "ns.usage": 15, northstar: 90, "exploradores.csat": 90, "geniex.usage": 20 }, manual: { "geniex.usage": { value: 20, source: "planilha" } }, intro: "", notes: "", updatedAt: null },
      { period: "2026-10-1", goals: {}, manual: {}, intro, notes, updatedAt: "2026-10-02T20:16:00.000Z" },
    ],
    syncs: { "2026-10-1": sync },
    weights: DEFAULT_WEIGHTS,
    now: new Date("2026-10-20T12:00:00Z"),
    author: { name: "Fernando <Rodrigues>", avatarUrl: null },
  });

const opts = { generatedAt: "2026-10-20T12:00:00.000Z", status: "concluido" as const };

test("HTML: blocos do report de referência, na ordem", () => {
  const html = renderReportHtml(model(), opts);
  const order = ["Report da Área - Gestão de Produto", "Período: 01/10 a 15/10 (Q1/10)", "Concluído", "Fala pessoal, boa tarde.", "1. Resumo dos Indicadores", "GESTÃO DE PRODUTO", "GENIEX", "EXPLORADORES", "EDUCADORES", "2. Evolução dos Indicadores", "Educadores - Aderência", "Exploradores - Aderência", "GenieX - Aderência", "CSAT Médio das Plataformas", "Tempo de uso", "NorthStar - Média Anual", "Observações e conclusões executivas"];
  let last = -1;
  for (const s of order) {
    const i = html.indexOf(s, last + 1);
    assert.ok(i > last, `ausente ou fora de ordem: ${s}`);
    last = i;
  }
  assert.match(html, /Meta \(Q1\/10\)/);
  assert.match(html, /Nova Meta \(Próxima Quinzena\)/);
  assert.match(html, />98,8%</); // North Star em %
  assert.match(html, /aria-label="Atingiu"/);
  assert.match(html, /aria-label="Abaixo da meta"/); // CSAT Exploradores 78,9 < 90
  assert.equal((html.match(/<svg xmlns/g) ?? []).length, 6);
  assert.match(html, /02 de outubro de 2026, 17:16/);
});

test("HTML: texto livre e dados vindos do banco são escapados", () => {
  const html = renderReportHtml(model(), opts);
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /Fernando &lt;Rodrigues&gt;/);
});

test("mensagem de abertura: a escrita vence a padrão", () => {
  assert.equal(defaultIntro("2026-09-2"), "Fala pessoal, boa tarde.\nSegue o report referente ao Q2 do mês de Setembro.");
  const html = renderReportHtml(model("", "Oi time!"), opts);
  assert.match(html, /Oi time!/);
  assert.ok(!html.includes("Fala pessoal"));
});

test("status do report", () => {
  assert.equal(reportStatus(true, true), "concluido");
  assert.equal(reportStatus(true, false), "em_revisao");
  assert.equal(reportStatus(false, false), "em_andamento");
});

test("formato curto da referência", () => {
  assert.equal(formatCompact(50, "%"), "50%");
  assert.equal(formatCompact(43.7, "%"), "43,7%");
  assert.equal(formatCompact(98.8358, "%"), "98,8%");
  assert.equal(formatCompact(22, "min"), "22 min");
  assert.equal(formatCompact(null, "%"), "—");
});

test("gráficos: os 6 da referência, com metas e média", () => {
  const charts = buildCharts(model());
  assert.deepEqual(charts.map((c) => c.tag), ["Educadores - Aderência", "Exploradores - Aderência", "GenieX - Aderência", "CSAT Médio das Plataformas", "Tempo de uso", "NorthStar - Média Anual"]);
  const edu = charts[0];
  assert.deepEqual(edu.refs.map((r) => r.label), ["Meta da plataforma", "Meta Q1/10"]);
  assert.deepEqual(edu.stats.map((s) => `${s.label} ${s.value}`), ["Média Q1/10 64%", "Meta —"]);
  assert.equal(edu.ticks.at(-1), "01/Out");
  assert.equal(charts[3].title, "CSAT Médio das Plataformas - Q1 Outubro");
  assert.match(charts[5].refs[0].label, /^Média anual \(98,8%\)$/);
  assert.equal(charts[4].refs[0].label, "Média (Q1/10)");
});

test("gráfico: quinzena sem dado quebra a linha e cada ponto tem rótulo", () => {
  assert.deepEqual(segments([1, 2, null, 4, null, null, 7, 8]), [[0, 1], [3], [6, 7]]);
  const spec = buildCharts(model())[0];
  const prims = layoutChart(spec);
  // só a última quinzena tem dado: um ponto, um rótulo, nenhuma linha da série
  assert.equal(prims.filter((p) => p.t === "circle").length, 1);
  assert.ok(prims.some((p) => p.t === "text" && p.text === "64%" && p.color === "#FFFFFF"));
  assert.ok(!prims.some((p) => p.t === "path" && p.color === "#2563EB"));
  assert.match(chartSvg(spec), /^<svg /);
});

test("PDF: gera um documento válido", async () => {
  const buf = await renderReportPdf(model(), opts);
  assert.equal(buf.subarray(0, 4).toString(), "%PDF");
  const pages = (buf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length;
  assert.ok(pages >= 2 && pages <= 4, `páginas: ${pages}`);
});

test("PDF: quinzena sem nenhum dado não quebra", async () => {
  const empty = buildReportModel({ period: "2026-10-1", stored: [], syncs: {}, weights: DEFAULT_WEIGHTS, now: new Date("2026-10-20T12:00:00Z") });
  const buf = await renderReportPdf(empty, { ...opts, status: "em_revisao" });
  assert.equal(buf.subarray(0, 4).toString(), "%PDF");
});

test("PDF: texto só com caracteres que a fonte padrão tem (senão a linha embaralha)", () => {
  assert.equal(pdfText("−1,0 min"), "-1,0 min");
  assert.equal(pdfText("Aderência · 2ª quinzena — “ok” ✅🚀 Σ"), "Aderência · 2ª quinzena — “ok”  ");
  assert.equal(pdfText("ÁÉÍÓÚ àç ÿ €"), "ÁÉÍÓÚ àç ÿ €");
});
