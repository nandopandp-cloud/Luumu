/*
  Contrato com a plataforma externa (lib/accessibility/integration.ts) e assinatura do webhook
  (lib/accessibility/webhook.ts).
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { normalizeExternalState, prefsDiff, safeWebhookUrl, PREF_FIELDS } from "@/lib/accessibility/integration";
import { DEFAULT_PREFS } from "@/lib/accessibility/features";
import { normalizeA11yConfig, publicA11yConfig } from "@/lib/accessibility/config";
import { signWebhook } from "@/lib/accessibility/webhook";

test("setUser: aceita só valores conhecidos", () => {
  assert.deepEqual(normalizeExternalState(null), { invite: false, profiles: [], status: "pending", prefs: null });
  const s = normalizeExternalState({ invite: true, profiles: ["leitura", "xyz", "leitura", "calma"], status: "aceito", prefs: { textSize: 9, highlightLinks: true, hack: 1 } });
  assert.equal(s.invite, true);
  assert.deepEqual(s.profiles, ["leitura", "calma"]);
  assert.equal(s.status, "pending", "status desconhecido cai em pending");
  assert.equal(s.prefs!.highlightLinks, true);
  assert.ok(s.prefs!.textSize <= 4, "tamanho do texto limitado");
  assert.equal("hack" in s.prefs!, false);
  assert.equal(normalizeExternalState({ invite: "true" }).invite, false, "só o booleano true convida");
});

test("prefsDiff lista só o que mudou", () => {
  assert.deepEqual(prefsDiff(DEFAULT_PREFS, { ...DEFAULT_PREFS, contrast: "dark", profiles: ["visao"] }), [
    { field: "contrast", from: "off", to: "dark" },
    { field: "profiles", from: [], to: ["visao"] },
  ]);
});

test("referência de campos cobre todas as preferências", () => {
  const fields = PREF_FIELDS.map((f) => f.field).sort();
  const prefs = Object.keys(DEFAULT_PREFS).sort();
  assert.deepEqual(fields, prefs);
});

test("URL do webhook: só https pública, sem credenciais", () => {
  assert.equal(safeWebhookUrl("https://plataforma.com.br/hook"), "https://plataforma.com.br/hook");
  for (const bad of ["http://plataforma.com.br/hook", "https://user:pw@x.com/", "https://localhost/x", "https://127.0.0.1/x", "https://10.0.0.5/x", "https://192.168.1.1/", "https://169.254.169.254/latest", "https://[::1]/", "https://api.internal/x", "ftp://x.com", "nada"]) {
    assert.equal(safeWebhookUrl(bad), "", bad);
  }
});

test("config pública: a URL do webhook não vai para o navegador, só se ele existe", () => {
  const pub = publicA11yConfig(normalizeA11yConfig({ integration: { mode: "external", webhookUrl: "https://plataforma.com.br/hook" } }));
  assert.deepEqual(pub.integration, { mode: "external", webhook: true });
  assert.equal(JSON.stringify(pub).includes("plataforma.com.br"), false);
  assert.equal(pub.nudge.hasList, false, "modo externo não consulta a lista da Luumu");
});

test("assinatura do webhook: HMAC-SHA256 de '<timestamp>.<corpo>'", () => {
  const body = JSON.stringify({ event: "test" });
  const expected = "sha256=" + createHmac("sha256", "a11y_segredo").update(`1700000000.${body}`).digest("hex");
  assert.equal(signWebhook("a11y_segredo", 1700000000, body), expected);
});
