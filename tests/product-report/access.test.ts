import { test } from "node:test";
import assert from "node:assert/strict";
import { isProductReportUser, PRODUCT_REPORT_EMAIL, type ProductReportUserLookup } from "@/lib/product-report/authorize";

const AUTHORIZED = { id: "usr_ok", email: PRODUCT_REPORT_EMAIL };
const OTHER = { id: "usr_other", email: "outra.pessoa@jovensgenios.com" };

/** "Banco" de teste: só devolve o usuário pelo id, como getUserById. */
const db = (...users: { id: string; email: string }[]): ProductReportUserLookup => async (id) =>
  users.find((u) => u.id === id) ?? null;

test("a conta autorizada tem acesso", async () => {
  assert.equal(await isProductReportUser({ userId: AUTHORIZED.id }, db(AUTHORIZED, OTHER), undefined), true);
});

test("o e-mail autorizado é exatamente o combinado", () => {
  assert.equal(PRODUCT_REPORT_EMAIL, "nandopandp@gmail.com");
});

test("outra conta autenticada é bloqueada", async () => {
  assert.equal(await isProductReportUser({ userId: OTHER.id }, db(AUTHORIZED, OTHER), undefined), false);
});

test("sem sessão não há acesso", async () => {
  assert.equal(await isProductReportUser(null, db(AUTHORIZED), undefined), false);
  assert.equal(await isProductReportUser(undefined, db(AUTHORIZED), undefined), false);
  assert.equal(await isProductReportUser({ userId: "" }, db(AUTHORIZED), undefined), false);
});

test("o e-mail informado pelo cliente (claim/sessão) é ignorado: vale o do banco", async () => {
  // sessão de outra conta alegando o e-mail autorizado
  const forged = { userId: OTHER.id, email: PRODUCT_REPORT_EMAIL };
  assert.equal(await isProductReportUser(forged, db(AUTHORIZED, OTHER), undefined), false);
});

test("conta removida perde o acesso mesmo com sessão ainda válida", async () => {
  assert.equal(await isProductReportUser({ userId: AUTHORIZED.id }, db(OTHER), undefined), false);
});

test("o banco devolvendo outra conta não libera", async () => {
  const wrong: ProductReportUserLookup = async () => AUTHORIZED;
  assert.equal(await isProductReportUser({ userId: OTHER.id }, wrong, undefined), false);
});

test("e-mail parecido não passa (sem prefixo, sufixo ou domínio diferente)", async () => {
  for (const email of ["nandopandp@gmail.com.br", "xnandopandp@gmail.com", "nandopandp@gmail.co", "nandopandp+1@gmail.com"]) {
    const u = { id: "usr_x", email };
    assert.equal(await isProductReportUser({ userId: u.id }, db(u), undefined), false, email);
  }
});

test("caixa e espaços do e-mail no banco não importam", async () => {
  const u = { id: "usr_ok", email: "  NandoPandP@Gmail.com " };
  assert.equal(await isProductReportUser({ userId: u.id }, db(u), undefined), true);
});

test("com PRODUCT_REPORT_USER_ID, só o id fixado entra (conta recriada com o mesmo e-mail não)", async () => {
  const recreated = { id: "usr_recriada", email: PRODUCT_REPORT_EMAIL };
  assert.equal(await isProductReportUser({ userId: AUTHORIZED.id }, db(AUTHORIZED), AUTHORIZED.id), true);
  assert.equal(await isProductReportUser({ userId: recreated.id }, db(recreated), AUTHORIZED.id), false);
});

test("o id fixado não dispensa o e-mail", async () => {
  assert.equal(await isProductReportUser({ userId: OTHER.id }, db(OTHER), OTHER.id), false);
});
