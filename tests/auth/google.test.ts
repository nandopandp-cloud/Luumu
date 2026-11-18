import { test } from "node:test";
import assert from "node:assert/strict";
import { checkGoogleClaims, googleAuthUrl, isAllowedEmail, isGoogleLoginError, jgProjectIds } from "@/lib/auth/google";
import { safeNext } from "@/lib/auth/next";

test("só e-mails exatamente do domínio da Jovens Gênios", () => {
  assert.equal(isAllowedEmail("ana@jovensgenios.com"), true);
  assert.equal(isAllowedEmail("  Ana@JovensGenios.com "), true);
  assert.equal(isAllowedEmail("ana@gmail.com"), false);
  assert.equal(isAllowedEmail("ana@jovensgenios.com.evil.com"), false);
  assert.equal(isAllowedEmail("ana@sub.jovensgenios.com"), false);
  assert.equal(isAllowedEmail("jovensgenios.com@gmail.com"), false);
  assert.equal(isAllowedEmail("@jovensgenios.com"), false);
  assert.equal(isAllowedEmail(undefined), false);
});

const ok = { nonce: "n1", email: "Ana@jovensgenios.com", email_verified: true, hd: "jovensgenios.com", name: "Ana Souza" };

test("claims válidos: e-mail normalizado e nome", () => {
  assert.deepEqual(checkGoogleClaims(ok, "n1"), { ok: true, email: "ana@jovensgenios.com", name: "Ana Souza" });
  assert.deepEqual(checkGoogleClaims({ ...ok, name: undefined }, "n1"), { ok: true, email: "ana@jovensgenios.com", name: "ana" });
});

test("claims recusados: nonce, e-mail não verificado, sem hd ou de outro domínio", () => {
  assert.deepEqual(checkGoogleClaims(ok, "outro"), { ok: false, error: "google_state" });
  assert.deepEqual(checkGoogleClaims(ok, ""), { ok: false, error: "google_state" });
  assert.deepEqual(checkGoogleClaims({ ...ok, email_verified: false }, "n1"), { ok: false, error: "google_domain" });
  assert.deepEqual(checkGoogleClaims({ ...ok, email_verified: "true" }, "n1"), { ok: false, error: "google_domain" });
  // conta Google pessoal com e-mail do domínio (sem Workspace): sem hd
  assert.deepEqual(checkGoogleClaims({ ...ok, hd: undefined }, "n1"), { ok: false, error: "google_domain" });
  assert.deepEqual(checkGoogleClaims({ ...ok, hd: "gmail.com", email: "ana@gmail.com" }, "n1"), { ok: false, error: "google_domain" });
  assert.deepEqual(checkGoogleClaims({ ...ok, hd: "jovensgenios.com", email: "ana@gmail.com" }, "n1"), { ok: false, error: "google_domain" });
});

test("URL de autorização com PKCE, state, nonce e dica de domínio", () => {
  const u = new URL(googleAuthUrl({ clientId: "cid", redirectUri: "https://app/cb", state: "s", nonce: "n", codeChallenge: "c" }));
  assert.equal(u.origin + u.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(u.searchParams.get("code_challenge_method"), "S256");
  assert.equal(u.searchParams.get("hd"), "jovensgenios.com");
  assert.equal(u.searchParams.get("scope"), "openid email profile");
  assert.equal(u.searchParams.get("redirect_uri"), "https://app/cb");
});

test("projetos da conta nova: os ligados no Report Quinzenal, senão pelo nome", () => {
  const projects = [
    { id: "p1", name: "GenieX" },
    { id: "p2", name: "Plataforma Exploradores" },
    { id: "p3", name: "Educadores" },
    { id: "p4", name: "Outro cliente" },
  ];
  assert.deepEqual(jgProjectIds({}, projects), ["p1", "p2", "p3"]);
  assert.deepEqual(jgProjectIds({ geniex: "p4" }, projects), ["p4", "p2", "p3"]);
  // ligação para projeto que não existe mais: cai para o nome
  assert.deepEqual(jgProjectIds({ educadores: "sumiu" }, projects), ["p1", "p2", "p3"]);
  assert.deepEqual(jgProjectIds({}, [{ id: "p4", name: "Outro cliente" }]), []);
});

test("destino pós-login não vira open redirect", () => {
  assert.equal(safeNext("/analytics"), "/analytics");
  assert.equal(safeNext("/surveys/abc/builder"), "/surveys/abc/builder");
  assert.equal(safeNext("//evil.com"), "/dashboard");
  assert.equal(safeNext("/\\evil.com"), "/dashboard");
  assert.equal(safeNext("https://evil.com"), "/dashboard");
  assert.equal(safeNext("/login"), "/dashboard");
  assert.equal(safeNext(null), "/dashboard");
});

test("códigos de erro conhecidos", () => {
  assert.equal(isGoogleLoginError("google_domain"), true);
  assert.equal(isGoogleLoginError("toString"), false);
  assert.equal(isGoogleLoginError("<script>"), false);
});
