import { test, before } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../tours/support/dom-env";

installDom("https://luumu.test/heatmaps");
let draw: typeof import("../../lib/heatmaps/draw");
before(async () => {
  (globalThis as Record<string, unknown>).DOMParser = (window as unknown as { DOMParser: typeof DOMParser }).DOMParser;
  draw = await import("../../lib/heatmaps/draw");
});

test("o painel limpa a cópia de novo antes de exibir", () => {
  const out = draw.sanitizeSnapshot(
    `<html><head><base href="javascript:alert(1)"><meta http-equiv="refresh" content="0;url=https://mal.com"></head><body><a href="javascript:alert(1)" onclick="x()">a</a><iframe src="https://x"></iframe><script>1</script><p>ok</p><svg><script>2</script></svg></body></html>`
  );
  assert.ok(!/<script|onclick|javascript:|<iframe|http-equiv|<base/i.test(out), out);
  assert.match(out, /<p>ok<\/p>/);
  assert.match(out, /animation-duration:0s/);
});

test("seções vêm dos títulos, em ordem, com o topo marcado", () => {
  document.body.innerHTML = `
    <h1 data-rect="0,0,800,60">Transforme feedback</h1>
    <h2 data-rect="0,1000,800,40">Como funciona</h2>
    <h2 data-rect="0,1010,800,40">Quase colado</h2>
    <h2 data-rect="0,2400,800,40">Preços</h2>`;
  Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, value: 4000 });
  const s = draw.detectSections(document);
  assert.deepEqual(s.map((x) => x.label), ["Transforme feedback (Topo)", "Como funciona", "Preços"]);
  assert.equal(s[1].top, 25);
  assert.equal(s[2].top, 60);
});

test("tipo do elemento pelo seletor", () => {
  assert.equal(draw.kindOfSelector("body>main>button:nth-of-type(2)"), "Botão");
  assert.equal(draw.kindOfSelector("#logo"), "Elemento");
  assert.equal(draw.kindOfSelector("body>nav>a"), "Link");
});
