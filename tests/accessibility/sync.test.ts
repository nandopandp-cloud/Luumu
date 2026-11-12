/*
  Regra do desfecho do convite entre chaves/aparelhos (lib/db/accessibility.ts → mergeNudge):
  "aceito" nunca é rebaixado; entre os outros, vale o mais recente.
*/
import { test } from "node:test";
import assert from "node:assert/strict";

// o módulo importa o cliente do banco, que exige a variável (nenhuma consulta é feita aqui)
process.env.DATABASE_URL ??= "postgres://teste:teste@localhost:5432/teste";

test("aceito vence dispensado/visto, mesmo mais antigo", async () => {
  const { mergeNudge } = await import("@/lib/db/accessibility");
  const accepted = { s: "accepted" as const, at: 100 };
  const dismissed = { s: "dismissed" as const, at: 500 };
  assert.deepEqual(mergeNudge(accepted, dismissed), accepted);
  assert.deepEqual(mergeNudge(dismissed, accepted), accepted);
  assert.deepEqual(mergeNudge({ s: "shown", at: 1 }, { s: "dismissed", at: 2 }), { s: "dismissed", at: 2 });
  assert.deepEqual(mergeNudge(null, dismissed), dismissed);
  assert.equal(mergeNudge(null, null), null);
});
