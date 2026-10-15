import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReportModel, type SyncSnapshot } from "../../lib/product-report/model";
import { DEFAULT_WEIGHTS } from "../../lib/product-report/indicators";
import { renderReportHtml } from "../../lib/product-report/render-html";
import { pdfText, renderReportPdf } from "../../lib/product-report/render-pdf";
import { lineChartSvg, segments } from "../../lib/product-report/svg-chart";

const sync: SyncSnapshot = {
  createdAt: "2026-10-16T10:00:00.000Z",
  status: "ok",
  error: null,
  projects: {},
  values: {
    "educadores.adherence": { value: 64 }, "educadores.usage": { value: 13 }, "educadores.csat": { value: 86.5, detail: "120 respostas · CSAT <Out>" },
    "exploradores.adherence": { value: 43.7 }, "exploradores.usage": { value: 5 }, "exploradores.csat": { value: 78.9 },
    "geniex.adherence": { value: 65 }, "geniex.usage": { value: 22 },
  },
};

const model = () =>
  buildReportModel({
    period: "2026-10-1",
    stored: [
      { period: "2026-09-2", goals: { "ns.csat": 95, "ns.adherence": 50, "ns.usage": 15, northstar: 95 }, manual: { "geniex.usage": { value: 20, source: "planilha" } }, notes: "", updatedAt: null },
      { period: "2026-10-1", goals: {}, manual: {}, notes: "Aderência subiu.\n<script>alert(1)</script>", updatedAt: null },
    ],
    syncs: { "2026-10-1": sync },
    weights: DEFAULT_WEIGHTS,
    now: new Date("2026-10-20T12:00:00Z"),
  });

test("HTML: as 10 seções do report de referência, na ordem", () => {
  const html = renderReportHtml(model(), { generatedAt: "2026-10-20T12:00:00.000Z" });
  const order = [
    "1. Report Quinzenal de Produto",
    "2. Gestão de Produto",
    "3. GenieX",
    "4. Exploradores",
    "5. Educadores",
    "6. Evolução dos indicadores",
    "7. Gráficos históricos",
    "8. Comparação com as metas",
    "9. Observações e conclusões executivas",
    "10. Geração",
  ];
  let last = -1;
  for (const s of order) {
    const i = html.indexOf(s);
    assert.ok(i > last, `seção fora de ordem ou ausente: ${s}`);
    last = i;
  }
  assert.match(html, /1ª quinzena de outubro\/2026/);
  assert.match(html, /01\/10\/2026 a 15\/10\/2026/);
  assert.match(html, />98,8</); // North Star
  assert.match(html, /Abaixo da meta/); // CSAT 82,7 < 95
  assert.equal((html.match(/<svg /g) ?? []).length, 4);
});

test("HTML: texto livre e dados vindos do banco são escapados", () => {
  const html = renderReportHtml(model(), { generatedAt: "2026-10-20T12:00:00.000Z" });
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.ok(!html.includes("CSAT <Out>"));
  assert.match(html, /CSAT &lt;Out&gt;/);
});

test("PDF: gera um documento válido com as seções", async () => {
  const buf = await renderReportPdf(model(), { generatedAt: "2026-10-20T12:00:00.000Z" });
  assert.equal(buf.subarray(0, 4).toString(), "%PDF");
  const pages = (buf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length;
  assert.ok(pages >= 2 && pages <= 6, `páginas: ${pages}`);
});

test("PDF: quinzena sem nenhum dado não quebra", async () => {
  const empty = buildReportModel({ period: "2026-10-1", stored: [], syncs: {}, weights: DEFAULT_WEIGHTS, now: new Date("2026-10-20T12:00:00Z") });
  const buf = await renderReportPdf(empty, { generatedAt: "2026-10-20T12:00:00.000Z" });
  assert.equal(buf.subarray(0, 4).toString(), "%PDF");
  assert.match(renderReportHtml(empty, { generatedAt: "2026-10-20T12:00:00.000Z" }), /Sem dado/);
});

test("PDF: texto só com caracteres que a fonte padrão tem (senão a linha embaralha)", () => {
  assert.equal(pdfText("−1,0 min"), "-1,0 min");
  assert.equal(pdfText("Aderência · 2ª quinzena — “ok” ✅🚀 Σ"), "Aderência · 2ª quinzena — “ok”  ");
  assert.equal(pdfText("ÁÉÍÓÚ àç ÿ €"), "ÁÉÍÓÚ àç ÿ €");
});

test("gráfico: quinzena sem dado quebra a linha em vez de ligar os pontos", () => {
  assert.deepEqual(segments([1, 2, null, 4, null, null, 7, 8]), [[0, 1], [3], [6, 7]]);
  const svg = lineChartSvg(
    [
      { label: "a", value: 10, target: 12 },
      { label: "b", value: null, target: 12 },
      { label: "c", value: 14, target: 12 },
    ],
    { unit: "%" }
  );
  // dois segmentos de valor (dois paths roxos), um ponto abaixo da meta em vermelho
  assert.equal((svg.match(/stroke="#6B2BD9"/g) ?? []).length, 2);
  assert.equal((svg.match(/fill="#dc2626"/g) ?? []).length, 1);
});
