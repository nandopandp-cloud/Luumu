import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, brDay, dayStart, fullDays, planRange } from "@/lib/analytics/rollup-range";

const at = (s: string) => new Date(s);
const all = () => true;

test("brDay e dayStart usam o dia de Brasília", () => {
  assert.equal(brDay(at("2026-11-03T02:59:59Z")), "2026-11-02");
  assert.equal(brDay(at("2026-11-03T03:00:00Z")), "2026-11-03");
  assert.equal(dayStart("2026-11-03").toISOString(), "2026-11-03T03:00:00.000Z");
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
});

test("fullDays: só os dias inteiros dentro do período", () => {
  // de terça 15h a sexta 10h (Brasília): quarta e quinta inteiras
  assert.deepEqual(fullDays(at("2026-11-03T18:00:00Z"), at("2026-11-06T13:00:00Z")), { first: "2026-11-04", last: "2026-11-05" });
  // começa exatamente à meia-noite: o próprio dia conta
  assert.deepEqual(fullDays(dayStart("2026-11-03"), dayStart("2026-11-05")), { first: "2026-11-03", last: "2026-11-04" });
  // menos de um dia inteiro
  assert.equal(fullDays(at("2026-11-03T18:00:00Z"), at("2026-11-04T13:00:00Z")), null);
});

test("planRange: pontas das telas, dias inteiros do resumo", () => {
  const from = at("2026-10-27T18:00:00Z");
  const to = at("2026-11-03T18:00:00Z");
  const p = planRange(from, to, all);
  assert.deepEqual(p.rollup, { first: "2026-10-28", last: "2026-11-02" });
  assert.deepEqual(p.raw, [
    { from, to: dayStart("2026-10-28") },
    { from: dayStart("2026-11-03"), to },
  ]);
});

test("planRange: dias ainda não resumidos no fim vão para as telas", () => {
  const from = at("2026-10-27T18:00:00Z");
  const to = at("2026-11-03T18:00:00Z");
  const p = planRange(from, to, (d) => d <= "2026-10-31");
  assert.deepEqual(p.rollup, { first: "2026-10-28", last: "2026-10-31" });
  assert.deepEqual(p.raw.at(-1), { from: dayStart("2026-11-01"), to });
});

test("planRange: um buraco no meio encerra o trecho do resumo", () => {
  const p = planRange(dayStart("2026-10-01"), dayStart("2026-10-10"), (d) => d !== "2026-10-05");
  assert.deepEqual(p.rollup, { first: "2026-10-01", last: "2026-10-04" });
  assert.deepEqual(p.raw, [{ from: dayStart("2026-10-05"), to: dayStart("2026-10-10") }]);
});

test("planRange: sem o primeiro dia pronto, tudo das telas", () => {
  const from = dayStart("2026-10-01");
  const to = dayStart("2026-10-10");
  assert.deepEqual(planRange(from, to, (d) => d > "2026-10-01"), { rollup: null, raw: [{ from, to }] });
  assert.deepEqual(planRange(at("2026-11-03T12:00:00Z"), at("2026-11-03T18:00:00Z"), all).rollup, null);
});
