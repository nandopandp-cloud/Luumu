import { test } from "node:test";
import assert from "node:assert/strict";
import { displayStatus } from "@/lib/surveys/schedule";

const today = "2026-11-04";

test("publicada com início no futuro aparece como agendada", () => {
  assert.equal(displayStatus("ativa", "2026-11-09", "2026-11-15", today), "agendada");
});

test("no dia do início (e durante a vigência) já é ativa; depois do fim continua ativa (fora do ar pelo SDK)", () => {
  assert.equal(displayStatus("ativa", "2026-11-04", "2026-11-15", today), "ativa");
  assert.equal(displayStatus("ativa", "2026-10-01", "2026-10-31", today), "ativa");
  assert.equal(displayStatus("ativa", null, null, today), "ativa");
});

test("rascunho, pausada e arquivada não viram agendada, mesmo com início no futuro", () => {
  assert.equal(displayStatus("rascunho", "2026-11-09", null, today), "rascunho");
  assert.equal(displayStatus("pausada", "2026-11-09", null, today), "pausada");
  assert.equal(displayStatus("encerrada", "2026-11-09", null, today), "encerrada");
});
