import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeStep, normalizeSteps, normalizeSettings, normalizeRoute, safeUrl, deviceConfig, deviceForWidth } from "../../lib/tours/normalize";
import { renderCard, esc } from "../../lib/tours/render";
import { DEFAULT_APPEARANCE } from "../../lib/tours/defaults";

test("URLs perigosas e rotas externas são recusadas", () => {
  assert.equal(safeUrl("javascript:alert(1)"), undefined);
  assert.equal(safeUrl("data:text/html,x"), undefined);
  assert.equal(safeUrl("https://ok.com/a.gif"), "https://ok.com/a.gif");
  assert.equal(normalizeRoute("//evil.com"), null);
  assert.equal(normalizeRoute("https://app.com/projects/?x=1"), "/projects");
  assert.equal(normalizeRoute("/projects/"), "/projects");
});

test("passo inválido vira passo seguro; ação fora da whitelist é descartada", () => {
  const s = normalizeStep({ type: "evil", title: 123, action: { type: "eval", value: "alert(1)" }, imageUrl: "javascript:x" });
  assert.equal(s.type, "tooltip");
  assert.equal(s.action.type, "none");
  assert.equal(s.imageUrl, undefined);
  const nav = normalizeStep({ type: "tooltip", action: { type: "open_url", value: "javascript:alert(1)" } });
  assert.equal(nav.action.type, "none");
});

test("modal nunca tem alvo; keys repetidas são trocadas; tour limitado a 50 passos", () => {
  const m = normalizeStep({ type: "modal", target: { tag: "button", fingerprint: "abc" } });
  assert.equal(m.target, null);
  const steps = normalizeSteps([{ key: "stp_aaaa" }, { key: "stp_aaaa" }]);
  assert.notEqual(steps[0].key, steps[1].key);
  assert.equal(normalizeSteps(Array.from({ length: 80 }, () => ({}))).length, 50);
});

test("configurações: gatilho por evento sem evento vira manual; cor inválida volta ao padrão", () => {
  const s = normalizeSettings({ trigger: { type: "event" }, appearance: { accent: "red; background:url(x)" } });
  assert.equal(s.trigger.type, "manual");
  assert.equal(s.appearance.accent, DEFAULT_APPEARANCE.accent);
});

test("responsivo: tablet herda do desktop, mobile tem configuração própria", () => {
  const step = normalizeStep({ type: "tooltip", placement: "right", responsive: { desktop: { placement: "left" }, mobile: { placement: "bottom", width: null } } });
  assert.equal(deviceConfig(step, "tablet").placement, "left");
  assert.equal(deviceConfig(step, "mobile").placement, "bottom");
  assert.equal(deviceForWidth(390), "mobile");
  assert.equal(deviceForWidth(800), "tablet");
  assert.equal(deviceForWidth(1440), "desktop");
});

test("render escapa todo texto configurável", () => {
  const step = normalizeStep({ type: "tooltip", title: "<img src=x onerror=alert(1)>", body: "\"><script>x</script>" });
  const html = renderCard(step, { index: 0, total: 2, appearance: DEFAULT_APPEARANCE, side: "bottom", arrow: 20, width: 320 });
  assert.ok(!html.includes("<img src=x"));
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;img"));
  assert.equal(esc(`<a href="x">'`), "&lt;a href=&quot;x&quot;&gt;&#39;");
  assert.ok(html.includes('role="dialog"'));
  assert.ok(html.includes("1 de 2"));
});
