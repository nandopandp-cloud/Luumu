/*
  Dono do ID anônimo (sdk/shared/anon-owner.ts): num computador compartilhado cada estudante
  fica com o próprio ID; a mesma pessoa saindo e voltando mantém o dela.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_KNOWN, ownerOf, switchOwner, type AnonState } from "@/sdk/shared/anon-owner";

let n = 0;
const fresh = () => `novo${++n}`;
const start: AnonState = { id: "lab01", owner: null, known: [] };
const alice = ownerOf({ id: "123", email: "Alice@Escola.com" });
const bruno = ownerOf({ id: "456", email: "bruno@escola.com" });

test("o primeiro estudante identificado fica com o ID que o navegador já tinha", () => {
  const r = switchOwner(start, alice, fresh);
  assert.equal(r.changed, false);
  assert.equal(r.state.id, "lab01");
  assert.deepEqual(r.state.owner, alice);
});

test("outro estudante no mesmo navegador ganha um ID novo; quem volta recupera o seu", () => {
  const a = switchOwner(start, alice, fresh).state;
  const b = switchOwner(a, bruno, fresh);
  assert.equal(b.changed, true);
  assert.notEqual(b.state.id, "lab01");
  const back = switchOwner(b.state, alice, fresh);
  assert.equal(back.changed, true);
  assert.equal(back.state.id, "lab01", "Alice volta ao ID dela, não ganha um terceiro");
  const again = switchOwner(back.state, bruno, fresh);
  assert.equal(again.state.id, b.state.id, "Bruno também");
});

test("a mesma pessoa com id ou e-mail a mais não troca; na dúvida, não troca", () => {
  const a = switchOwner(start, ownerOf({ email: "alice@escola.com" }), fresh).state;
  const withId = switchOwner(a, alice, fresh);
  assert.equal(withId.changed, false, "mesmo e-mail, agora com id");
  assert.equal(withId.state.owner?.i, alice!.i);
  // só id de um lado e só e-mail do outro: não dá para saber que é outra pessoa
  const onlyId = switchOwner(switchOwner(start, ownerOf({ id: "123" }), fresh).state, ownerOf({ email: "x@y.com" }), fresh);
  assert.equal(onlyId.changed, false);
  // identify sem id nem e-mail não mexe em nada
  assert.equal(switchOwner(a, ownerOf({ name: "Ana" } as { id?: unknown }), fresh).changed, false);
});

test("id e e-mail viram impressão digital, sem maiúsculas nem espaços, e nunca texto puro", () => {
  assert.deepEqual(ownerOf({ id: " 123 ", email: "ALICE@escola.com" }), alice);
  assert.ok(!JSON.stringify(alice).includes("alice"));
  assert.ok(!JSON.stringify(alice).includes("123\""));
});

test("o navegador lembra no máximo MAX_KNOWN estudantes", () => {
  let st = start;
  for (let i = 0; i < MAX_KNOWN + 10; i++) st = switchOwner(st, ownerOf({ id: `e${i}` }), fresh).state;
  assert.equal(st.known.length, MAX_KNOWN);
});
