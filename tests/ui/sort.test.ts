import { test } from "node:test";
import assert from "node:assert/strict";
import { compareValues, firstDir, sortRows } from "../../lib/sort";

test("números e datas nos dois sentidos; vazios sempre no fim", () => {
  const rows = [{ v: 3 }, { v: null }, { v: 10 }, { v: 1 }, { v: undefined }];
  assert.deepEqual(sortRows(rows, (r) => r.v, "desc").map((r) => r.v), [10, 3, 1, null, undefined]);
  assert.deepEqual(sortRows(rows, (r) => r.v, "asc").map((r) => r.v), [1, 3, 10, null, undefined]);
  const d = (s: string) => new Date(s);
  assert.equal(compareValues(d("2026-01-02"), d("2026-01-01"), "desc") < 0, true);
});

test("textos em pt-BR: sem diferenciar acento/caixa, números dentro do texto em ordem natural", () => {
  const names = ["Érica", "ana", "Bruno", "Ana 10", "Ana 2"];
  assert.deepEqual(sortRows(names, (x) => x, "asc"), ["ana", "Ana 2", "Ana 10", "Bruno", "Érica"]);
  assert.deepEqual(sortRows(["", "b", "a"], (x) => x, "asc"), ["a", "b", ""]); // texto vazio = sem dado
});

test("estável nos empates e primeiro sentido por tipo", () => {
  const rows = [{ id: 1, v: 5 }, { id: 2, v: 5 }, { id: 3, v: 9 }];
  assert.deepEqual(sortRows(rows, (r) => r.v, "desc").map((r) => r.id), [3, 1, 2]);
  assert.equal(firstDir("texto"), "asc");
  assert.equal(firstDir(42), "desc");
});
