import { test } from "node:test";
import assert from "node:assert/strict";
import { csatFromSurveys, type SurveyCsat } from "@/lib/product-report/csat";

const s = (surveyName: string, value: number | null, lastAt: string, answered = 100): SurveyCsat => ({ surveyName, value, answered, lastAt: Date.parse(lastAt) });

test("média simples das 2 pesquisas mais recentes da quinzena", () => {
  const r = csatFromSurveys([s("19/10", 80, "2026-10-25T12:00:00Z", 130), s("28/10", 90, "2026-10-28T12:00:00Z")]);
  assert.equal(r.value, 85);
  assert.deepEqual(r.used.map((x) => x.surveyName), ["28/10", "19/10"]);
  assert.deepEqual(r.warnings, []);
  assert.match(r.detail!, /Média das 2 últimas pesquisas/);
});

test("com 3 pesquisas, a mais antiga fica de fora (vale a última resposta de cada uma)", () => {
  const r = csatFromSurveys([
    s("19/10 (A)", 70, "2026-10-21T12:00:00Z", 99),
    s("19/10 (B)", 80, "2026-10-25T12:00:00Z", 130),
    s("28/10", 90, "2026-10-28T12:00:00Z"),
  ]);
  assert.equal(r.value, 85);
  assert.deepEqual(r.used.map((x) => x.surveyName), ["28/10", "19/10 (B)"]);
});

test("uma pesquisa só: vale a nota dela (sem dividir por 2) e vira aviso", () => {
  const r = csatFromSurveys([s("02/11", 88, "2026-11-04T12:00:00Z", 11)]);
  assert.equal(r.value, 88);
  assert.equal(r.warnings.length, 1);
});

test("sem nota calculável: vazio, com aviso; pesquisa sem nota não conta como uma das 2", () => {
  assert.equal(csatFromSurveys([]).value, null);
  assert.equal(csatFromSurveys([s("x", null, "2026-10-30T12:00:00Z")]).value, null);
  const r = csatFromSurveys([s("sem nota", null, "2026-10-30T12:00:00Z"), s("a", 80, "2026-10-20T12:00:00Z"), s("b", 60, "2026-10-18T12:00:00Z")]);
  assert.equal(r.value, 70);
});
