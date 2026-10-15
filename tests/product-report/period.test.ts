import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isClosed,
  lastClosedPeriod,
  parsePeriod,
  periodDates,
  periodLabel,
  periodOf,
  periodRange,
  periodShortLabel,
  periodsUntil,
  shiftPeriod,
} from "../../lib/product-report/period";

test("1ª quinzena = dias 1 a 15; 2ª = 16 ao fim do mês, em horário de Brasília", () => {
  const q1 = periodRange("2026-10-1");
  assert.equal(q1.from.toISOString(), "2026-10-01T03:00:00.000Z");
  assert.equal(q1.to.toISOString(), "2026-10-16T03:00:00.000Z");
  const q2 = periodRange("2026-02-2");
  assert.equal(q2.from.toISOString(), "2026-02-16T03:00:00.000Z");
  assert.equal(q2.to.toISOString(), "2026-03-01T03:00:00.000Z");
  assert.equal(periodRange("2026-12-2").to.toISOString(), "2027-01-01T03:00:00.000Z");
  assert.equal(periodDates("2026-02-2"), "16/02/2026 a 28/02/2026");
});

test("quinzenas vizinhas não se sobrepõem nem deixam buraco", () => {
  for (const p of periodsUntil("2027-01-1", 30)) {
    assert.equal(periodRange(p).to.getTime(), periodRange(shiftPeriod(p, 1)).from.getTime(), p);
  }
});

test("periodOf usa o dia de Brasília (02:30 UTC de 16/10 ainda é dia 15)", () => {
  assert.equal(periodOf(new Date("2026-10-16T02:30:00Z")), "2026-10-1");
  assert.equal(periodOf(new Date("2026-10-16T03:00:00Z")), "2026-10-2");
  assert.equal(periodOf(new Date("2026-11-01T02:59:59Z")), "2026-10-2");
});

test("última quinzena encerrada e navegação", () => {
  assert.equal(lastClosedPeriod(new Date("2026-10-15T15:00:00Z")), "2026-09-2");
  assert.equal(lastClosedPeriod(new Date("2026-10-16T15:00:00Z")), "2026-10-1");
  assert.equal(shiftPeriod("2026-01-1", -1), "2025-12-2");
  assert.equal(shiftPeriod("2026-12-2", 1), "2027-01-1");
  assert.equal(shiftPeriod("2026-05-2", -3), "2026-04-1");
  assert.deepEqual(periodsUntil("2026-10-1", 3), ["2026-09-1", "2026-09-2", "2026-10-1"]);
  assert.equal(isClosed("2026-10-1", new Date("2026-10-16T03:00:00Z")), true);
  assert.equal(isClosed("2026-10-1", new Date("2026-10-16T02:59:59Z")), false);
});

test("ids inválidos são recusados", () => {
  for (const bad of ["2026-10-3", "2026-13-1", "2026-1-1", "", "2026-10-1; drop", null, undefined]) {
    assert.equal(parsePeriod(bad), null, String(bad));
  }
  assert.throws(() => periodRange("x"));
});

test("rótulos", () => {
  assert.equal(periodLabel("2026-09-2"), "2ª quinzena de setembro/2026");
  assert.equal(periodShortLabel("2026-09-2"), "Q2 set/26");
});
