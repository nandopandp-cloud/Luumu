import { test } from "node:test";
import assert from "node:assert/strict";
import {
  baseName,
  defaultInterval,
  dueForNext,
  durationDays,
  intervalFits,
  nextOccurrence,
  occurrenceName,
  recurrenceLabel,
  weekdayOf,
} from "@/lib/surveys/recurrence";

// 2026-11-16 é segunda-feira; 2026-11-22, domingo
test("duração e dia da semana da vigência", () => {
  assert.equal(durationDays("2026-11-16", "2026-11-22"), 6);
  assert.equal(durationDays("2026-11-16", "2026-11-16"), 0);
  assert.equal(weekdayOf("2026-11-16"), "segunda");
  assert.equal(weekdayOf("2026-11-22"), "domingo");
});

test("intervalo precisa comportar a vigência (uma rodada não começa antes da anterior terminar)", () => {
  assert.equal(intervalFits(1, 6), true);
  assert.equal(intervalFits(1, 7), false);
  assert.equal(intervalFits(2, 13), true);
  assert.equal(defaultInterval(6), 1);
  assert.equal(defaultInterval(10), 2);
  assert.equal(defaultInterval(20), 4);
  assert.equal(defaultInterval(30), null);
});

test("próxima rodada: mesmos dias da semana, N semanas depois", () => {
  const n = nextOccurrence("2026-11-16", 1, 6, "2026-11-16");
  assert.deepEqual(n, { startsAt: "2026-11-23", endsAt: "2026-11-29" });
  assert.equal(weekdayOf(n.startsAt), "segunda");
  assert.equal(weekdayOf(n.endsAt), "domingo");
  assert.deepEqual(nextOccurrence("2026-11-16", 2, 6, "2026-11-16"), { startsAt: "2026-11-30", endsAt: "2026-12-06" });
});

test("cron parado por semanas: pula as rodadas que já terminaram", () => {
  // última rodada 02/11; hoje 25/11 → a de 16–22/11 já acabou, a de 23–29/11 está em curso
  assert.deepEqual(nextOccurrence("2026-11-02", 1, 6, "2026-11-25"), { startsAt: "2026-11-23", endsAt: "2026-11-29" });
});

test("a próxima rodada só é criada quando a última começa (sempre uma à frente)", () => {
  assert.equal(dueForNext("2026-11-23", "2026-11-16"), false);
  assert.equal(dueForNext("2026-11-23", "2026-11-23"), true);
  assert.equal(dueForNext("2026-11-16", "2026-11-20"), true);
});

test("nome de cada rodada e nome-base", () => {
  assert.equal(occurrenceName("CSAT GenieX", "2026-11-16", "2026-11-22"), "CSAT GenieX · 16/11 a 22/11");
  assert.equal(baseName("CSAT GenieX · 16/11 a 22/11"), "CSAT GenieX");
  assert.equal(baseName("CSAT GenieX"), "CSAT GenieX");
});

test("rótulo da recorrência", () => {
  assert.equal(recurrenceLabel(1, "2026-11-16", "2026-11-22"), "Toda semana, de segunda a domingo");
  assert.equal(recurrenceLabel(2, "2026-11-18", "2026-11-18"), "A cada 2 semanas, na quarta");
});
