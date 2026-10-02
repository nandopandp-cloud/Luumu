import { test } from "node:test";
import assert from "node:assert/strict";
import { fillDays, periodToRange, periodLabel } from "../../lib/period";

test("sem período na URL = últimos 30 dias (igual ao que o seletor mostra)", () => {
  const { from } = periodToRange(undefined);
  const days = Math.round((Date.now() - from!.getTime()) / 86_400_000);
  assert.equal(days, 30);
  assert.equal(periodLabel(undefined), "Últimos 30 dias");
  assert.equal(periodToRange("all").from, undefined);
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
