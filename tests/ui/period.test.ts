import { test } from "node:test";
import assert from "node:assert/strict";
import { fillDays, PERIOD_OPTIONS, periodToRange, periodLabel, startOfTodayBR } from "../../lib/period";

test("sem período na URL = Hoje (igual ao que o seletor mostra), desde a meia-noite de Brasília", () => {
  const { from } = periodToRange(undefined);
  assert.equal(from!.getTime(), startOfTodayBR().getTime());
  assert.equal(periodLabel(undefined), "Hoje");
  assert.equal(periodToRange("all").from, undefined);
  // 02:30 UTC de 05/10 ainda é 04/10 em Brasília
  assert.equal(startOfTodayBR(new Date("2026-10-05T02:30:00Z")).toISOString(), "2026-10-04T03:00:00.000Z");
  assert.equal(startOfTodayBR(new Date("2026-10-05T03:00:00Z")).toISOString(), "2026-10-05T03:00:00.000Z");
});

test("seletor: Hoje no lugar de 90 dias; links antigos com 90d continuam valendo", () => {
  assert.equal(PERIOD_OPTIONS[0].value, "today");
  assert.ok(!PERIOD_OPTIONS.some((p) => (p.value as string) === "90d"));
  assert.equal(periodLabel("90d"), "Últimos 90 dias");
  const days = Math.round((Date.now() - periodToRange("90d").from!.getTime()) / 86_400_000);
  assert.equal(days, 90);
});

test("fillDays completa os dias sem dado com zero", () => {
  const s = fillDays(
    [{ date: "2026-10-01", n: 3 }, { date: "2026-10-03", n: 1 }],
    (date) => ({ date, n: 0 }),
    new Date("2026-09-30T00:00:00Z"),
    new Date("2026-10-03T12:00:00Z")
  );
  assert.deepEqual(s.map((p) => p.n), [0, 3, 0, 1]);
});
