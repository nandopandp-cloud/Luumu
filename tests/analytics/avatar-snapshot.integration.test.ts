/*
  "Fotografia" do avatar (sdk/analytics/avatar-snapshot.ts): personagem em camadas, partes
  definidas em outro lugar da página (<use href="#rosto">) e imagens embutidas — o que faltava
  no avatar da Geniex (vinha sem o rosto) e no do Exploradores (nada).
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../tours/support/dom-env";
import { snapshotAvatar } from "../../sdk/analytics/avatar-snapshot";
import { sanitizeSvg } from "../../lib/analytics/svg-avatar";

installDom("https://preparasp.jovensgenios.com/home");
// PNG 1×1 embutido (sem rede nos testes)
const FACE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

test("camadas: corpo em SVG + rosto em <img> sobreposto viram um desenho só", async () => {
  document.body.innerHTML = `<div id="av"><svg viewBox="0 0 40 40"><rect width="40" height="40" fill="#7c3aed"/></svg><img src="${FACE}" alt=""></div>`;
  const s = await snapshotAvatar(document.getElementById("av")!);
  assert.equal(s.reason, "ok");
  assert.deepEqual(s.layers, ["svg", "img"]);
  assert.ok(s.svg!.startsWith("<svg"));
  assert.ok(s.svg!.includes("<rect")); // corpo
  assert.ok(s.svg!.includes(FACE)); // rosto embutido
  assert.ok(sanitizeSvg(s.svg!)?.includes(FACE)); // e passa na limpeza do servidor
});

test("rosto definido em OUTRO <svg> da página (<use href='#rosto'>) vem junto", async () => {
  document.body.innerHTML = `
    <svg style="display:none"><defs><symbol id="rosto" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#f4c27a"/><image href="${FACE}" width="10" height="10"/></symbol></defs></svg>
    <div id="av"><svg viewBox="0 0 40 40"><rect width="40" height="40" fill="#1e3a8a"/><use href="#rosto" x="10" y="5" width="20" height="20"/></svg></div>`;
  const s = await snapshotAvatar(document.getElementById("av")!);
  assert.equal(s.reason, "ok");
  assert.match(s.svg!, /<defs>[\s\S]*id="rosto"[\s\S]*<\/defs>/); // a parte que estava fora veio para dentro
  assert.ok(s.svg!.includes("<circle"));
  assert.ok(s.svg!.includes(FACE)); // imagem do rosto embutida
});

test("uma foto só, com endereço https: basta o endereço (sem embutir)", async () => {
  document.body.innerHTML = `<div id="av"><img src="/_next/image?url=https%3A%2F%2Ffiles-s3.jovensgenios.com%2Feu.png&w=64&q=75"></div>`;
  const s = await snapshotAvatar(document.getElementById("av")!);
  assert.equal(s.url, "https://files-s3.jovensgenios.com/eu.png");
});

test("sem nenhuma imagem: diz o porquê", async () => {
  document.body.innerHTML = `<button id="av"><span>FR</span></button>`;
  const s = await snapshotAvatar(document.getElementById("av")!);
  assert.equal(s.svg, undefined);
  assert.match(s.reason, /não tem imagem/);
});
