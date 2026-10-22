import { test } from "node:test";
import assert from "node:assert/strict";
import { computeNorthStar, formatDelta, formatValue, goalStatus, type PlatformValues, type Targets } from "@/lib/product-report/indicators";

/** Uma aba da planilha North Star: valores das plataformas, metas e o resultado que ela calcula. */
interface Sheet {
  tab: string;
  edu: [number, number, number]; // aderência, tempo, csat
  exp: [number, number, number];
  gnx: [number, number]; // aderência, tempo (sem CSAT)
  goals: [number, number, number]; // csat, aderência, tempo
  northStar: number;
}

// valores copiados das abas Q1/Q2 da planilha (colunas K–N e H4)
const SHEETS: Sheet[] = [
  { tab: "Q1MAIO", edu: [47.5, 10, 84.2], exp: [43.7, 4, 82.6], gnx: [43, 26], goals: [90, 50, 15], northStar: 90.25333333 },
  { tab: "Q2MAIO", edu: [51.78, 10, 81.4], exp: [46.9, 5, 94], gnx: [45.7, 22], goals: [95, 50, 15], northStar: 90.86273684 },
  { tab: "Q1JUNHO", edu: [41.5, 10, 85.7], exp: [32.88, 4, 87.7], gnx: [49, 21], goals: [95, 50, 15], northStar: 83.61361404 },
  { tab: "Q2JUNHO", edu: [40.6, 11, 77.9], exp: [34.7, 4, 81.6], gnx: [52, 24], goals: [95, 50, 15], northStar: 85.13087719 },
  { tab: "Q1JULHO", edu: [53.95, 10, 87.1], exp: [35.4, 4.3, 86.1], gnx: [59, 21], goals: [95, 50, 15], northStar: 90.44070175 },
  { tab: "Q2JULHO", edu: [59, 10, 86.5], exp: [39.7, 4, 85.1], gnx: [62, 16], goals: [95, 50, 15], northStar: 89.94807018 },
  { tab: "Q2SETEMBRO", edu: [64, 13, 86.5], exp: [43.7, 5, 78.9], gnx: [65, 22], goals: [95, 50, 15], northStar: 98.83578947 },
];

const toInputs = (s: Sheet): { values: PlatformValues; targets: Targets } => ({
  values: {
    "educadores.adherence": s.edu[0], "educadores.usage": s.edu[1], "educadores.csat": s.edu[2],
    "exploradores.adherence": s.exp[0], "exploradores.usage": s.exp[1], "exploradores.csat": s.exp[2],
    "geniex.adherence": s.gnx[0], "geniex.usage": s.gnx[1],
  },
  targets: { "ns.csat": s.goals[0], "ns.adherence": s.goals[1], "ns.usage": s.goals[2] },
});

for (const s of SHEETS) {
  test(`North Star igual à planilha: ${s.tab}`, () => {
    const { values, targets } = toInputs(s);
    const r = computeNorthStar(values, targets);
    assert.ok(r.value !== null);
    assert.ok(Math.abs(r.value - s.northStar) < 1e-6, `${r.value} ≠ ${s.northStar}`);
  });
}

test("componentes seguem a planilha: média, normalização e peso (Q2SETEMBRO)", () => {
  const { values, targets } = toInputs(SHEETS.at(-1)!);
  const [csat, adh, use] = computeNorthStar(values, targets).components;
  assert.equal(csat.value, (86.5 + 78.9) / 2); // GenieX não entra no CSAT
  assert.deepEqual(csat.platforms.map((p) => p.platform), ["exploradores", "educadores"]);
  assert.ok(Math.abs(adh.value! - 57.56666667) < 1e-6);
  assert.ok(Math.abs(adh.normalized! - 1.151333333) < 1e-6);
  assert.ok(Math.abs(adh.result! - 46.05333333) < 1e-6); // acima do peso: sem teto, como na planilha
  assert.ok(Math.abs(use.result! - 26.66666667) < 1e-6);
  assert.deepEqual([csat.weight, adh.weight, use.weight], [30, 40, 30]);
});

test("plataforma sem dado: consolidado e North Star ficam vazios (sem média parcial)", () => {
  const { values, targets } = toInputs(SHEETS[0]);
  delete values["geniex.usage"];
  const r = computeNorthStar(values, targets);
  const use = r.components.find((c) => c.metric === "usage")!;
  assert.equal(use.value, null);
  assert.deepEqual(use.missing, ["geniex"]);
  assert.equal(r.value, null);
  // os outros componentes continuam calculados
  assert.ok(r.components.find((c) => c.metric === "csat")!.result !== null);
});

test("sem meta do componente não há North Star", () => {
  const { values, targets } = toInputs(SHEETS[0]);
  delete targets["ns.adherence"];
  assert.equal(computeNorthStar(values, targets).value, null);
});

test("status de meta", () => {
  assert.equal(goalStatus(50, 50), "met");
  assert.equal(goalStatus(49.9, 50), "missed");
  assert.equal(goalStatus(null, 50), "no_data");
  assert.equal(goalStatus(10, null), "no_target");
});

test("formatação pt-BR", () => {
  assert.equal(formatValue(57.5666, "%"), "57,6%");
  assert.equal(formatValue(13.333, "min"), "13,3 min");
  assert.equal(formatValue(98.8357, "pts"), "98,8");
  assert.equal(formatValue(null, "%"), "—");
  assert.equal(formatDelta(3.24, "%"), "+3,2 p.p.");
  assert.equal(formatDelta(-1, "min"), "−1,0 min");
  assert.equal(formatDelta(0, "pts"), "0,0 pts");
});
