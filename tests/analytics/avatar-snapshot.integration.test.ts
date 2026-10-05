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

test("foco no rosto: com corpo na base, enquadra só cabeça/rosto/acessórios num quadrado", async () => {
  const { focusBox } = await import("../../sdk/analytics/avatar-snapshot");
  // camadas reais de um avatar da Geniex (40×40): cabeça, rosto, óculos, corpo
  const head = { x: 12.2, y: 4.6, w: 14.7, h: 17.6 };
  const face = { x: 17.4, y: 10.4, w: 8.9, h: 9.1 };
  const glasses = { x: 14.6, y: 12.2, w: 12.1, h: 4.3 };
  const body = { x: 6, y: 18.5, w: 26.4, h: 23.5 };
  const f = focusBox([head, face, glasses, body], 40, 40)!;
  assert.equal(Math.round(f.w), Math.round(f.h)); // quadrado
  assert.ok(f.w < 40 && f.w > head.h); // mais perto que o avatar inteiro, mas cabe a cabeça
  const cx = f.x + f.w / 2;
  const cy = f.y + f.h / 2;
  assert.ok(Math.abs(cx - (head.x + head.w / 2)) < 2 && Math.abs(cy - (head.y + head.h / 2)) < 2); // centrado na cabeça
  // sem corpo na base (só uma foto, ou camadas soltas): mantém o avatar inteiro
  assert.equal(focusBox([head], 40, 40), null);
  assert.equal(focusBox([head, face], 40, 40), null);
});

test("parece avatar? ícone de interface num botão não; foto/desenho sim", async () => {
  const { looksLikeAvatarBox } = await import("../../sdk/analytics/avatar-snapshot");
  // o ambiente de teste não mede layout: cada caso diz o tamanho que teria na tela
  const el = (html: string, w = 40, h = 40) => {
    document.body.innerHTML = html;
    const e = document.body.firstElementChild!;
    e.getBoundingClientRect = () => ({ width: w, height: h, x: 0, y: 0, top: 0, left: 0, right: w, bottom: h, toJSON: () => ({}) }) as DOMRect;
    return e;
  };
  // o botão de ajuda do cabeçalho do Exploradores: ícone lucide "?" + texto, largo
  assert.equal(looksLikeAvatarBox(el(`<button><svg class="lucide lucide-circle-help" viewBox="0 0 24 24" stroke="currentColor"><circle r="10"/></svg>Ajuda</button>`, 89, 20)), false);
  // só ícone de interface, mesmo quadrado
  assert.equal(looksLikeAvatarBox(el(`<button><svg viewBox="0 0 24 24" stroke="currentColor"><path d="M1 1"/></svg></button>`)), false);
  assert.equal(looksLikeAvatarBox(el(`<button><img src="https://files-s3.jovensgenios.com/a.png"></button>`)), true);
  assert.equal(looksLikeAvatarBox(el(`<div><svg viewBox="0 0 474 567"><path d="M1 1" fill="#fff"/></svg></div>`)), true);
  // foto, mas num botão largo com texto: não é o avatar
  assert.equal(looksLikeAvatarBox(el(`<button><img src="https://x.com/a.png">Perfil</button>`, 120, 36)), false);
  assert.equal(looksLikeAvatarBox(el(`<button><span>FR</span></button>`)), false);
});
