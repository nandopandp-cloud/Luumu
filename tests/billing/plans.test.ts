import { test } from "node:test";
import assert from "node:assert/strict";
import { annualTotal, COMPARE_ROWS, formatLimit, monthlyPrice, monthStart, PLAN_IDS, PLANS, planAllowsHeatmaps, planOf } from "../../lib/plans";

test("catálogo segue a referência: 5 planos, Growth popular, Enterprise sob consulta", () => {
  assert.deepEqual(PLANS.map((p) => p.id), [...PLAN_IDS]);
  assert.deepEqual(PLANS.map((p) => p.monthly), [0, 99, 299, 699, null]);
  assert.deepEqual(PLANS.filter((p) => p.popular).map((p) => p.id), ["growth"]);
});

test("anual tem 20% de desconto; sob consulta continua sob consulta", () => {
  const growth = planOf("growth");
  assert.equal(monthlyPrice(growth, "monthly"), 299);
  assert.equal(monthlyPrice(growth, "annual"), 239);
  assert.equal(annualTotal(growth), 239 * 12);
  assert.equal(monthlyPrice(planOf("free"), "annual"), 0);
  assert.equal(monthlyPrice(planOf("enterprise"), "annual"), null);
  assert.equal(annualTotal(planOf("enterprise")), null);
});

test("plano gravado desconhecido ou antigo cai no Growth", () => {
  assert.equal(planOf("GROWTH").id, "growth");
  assert.equal(planOf("starter").id, "starter");
  assert.equal(planOf("pro").id, "growth");
  assert.equal(planOf(null).id, "growth");
});

test("limites batem com os recursos exibidos e a tabela tem valor para todo plano", () => {
  for (const p of PLANS) {
    if (p.limits.responses !== Infinity) {
      assert.ok(p.features.some((f) => f.label.startsWith(p.limits.responses.toLocaleString("pt-BR"))), `${p.id}: respostas`);
    }
  }
  for (const r of COMPARE_ROWS) for (const id of PLAN_IDS) assert.notEqual(r.values[id], undefined, `${r.label}/${id}`);
  assert.equal(formatLimit(Infinity), "Ilimitado");
});

test("heatmaps já existem: sem selo, e o Free não os inclui", () => {
  assert.notEqual(COMPARE_ROWS.find((r) => r.label === "Heatmaps")?.soon, true);
  assert.equal(planAllowsHeatmaps(planOf("free")), false);
  assert.equal(planAllowsHeatmaps(planOf("starter")), true);
  assert.equal(planAllowsHeatmaps(planOf("enterprise")), true);
});

test("recurso que ainda não existe é marcado como Em breve", () => {
  for (const label of ["Session Replay", "API e Webhooks", "SSO/SAML"]) {
    assert.equal(COMPARE_ROWS.find((r) => r.label === label)?.soon, true, label);
  }
  for (const p of PLANS) {
    for (const f of p.features.filter((f) => f.included && /Replay|API|SSO/.test(f.label))) assert.equal(f.soon, true, `${p.id}: ${f.label}`);
  }
});

test("mês de cobrança começa à meia-noite de São Paulo", () => {
  // 1º de outubro, 01:00 em São Paulo (04:00 UTC) → mês de outubro
  assert.equal(monthStart(new Date("2026-10-01T04:00:00Z")).toISOString(), "2026-10-01T03:00:00.000Z");
  // 30 de setembro, 23:30 em São Paulo (1º/10 02:30 UTC) → ainda setembro
  assert.equal(monthStart(new Date("2026-10-01T02:30:00Z")).toISOString(), "2026-09-01T03:00:00.000Z");
});
