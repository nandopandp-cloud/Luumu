/* eslint-disable @typescript-eslint/no-explicit-any -- payloads JSON inspecionados campo a campo */
/*
  Avatar desenhado em SVG embutido (Exploradores/Geniex): o SDK copia o desenho (com as cores que a
  página aplica), manda uma vez por navegador; o servidor confere a impressão e limpa o conteúdo.
*/
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../tours/support/dom-env";
import { sanitizeSvg, svgHash, SVG_MAX } from "../../lib/analytics/svg-avatar";
import { readPageIdentity } from "../../sdk/analytics/page-identity";

installDom("https://squad.jovensgenios.com/inicio");

const AVATAR = `<header><div><div><div><button><svg viewBox="0 0 40 40" class="avatar"><circle cx="20" cy="20" r="18" class="pele"></circle><path d="M10 30h20"></path></svg></button></div></div></div></header>`;

test("limpeza: tira o que executa ou busca algo de fora, mantém o desenho", () => {
  const dirty = `<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(2)</script><foreignObject><div>x</div></foreignObject><a href="javascript:alert(3)"><circle r="4" onclick="x()" fill="url(https://evil.com/x)"/></a><use href="#p"/><image href="https://evil.com/t.png"/><circle r="2"/></svg>`;
  const clean = sanitizeSvg(dirty)!;
  for (const bad of ["onload", "<script", "foreignObject", "javascript:", "onclick", "evil.com"]) assert.ok(!clean.includes(bad), bad);
  assert.ok(clean.includes('href="#p"')); // âncora interna fica
  assert.ok(clean.includes("<circle r=\"2\"/>"));
  assert.equal(sanitizeSvg("<div>não é svg</div>"), null);
  assert.equal(sanitizeSvg(`<svg>${"x".repeat(SVG_MAX)}</svg>`), null);
});

test("impressão digital: estável e muda com o conteúdo", () => {
  assert.match(svgHash("<svg/>"), /^[0-9a-f]{16}$/);
  assert.equal(svgHash("<svg>a</svg>"), svgHash("<svg>a</svg>"));
  assert.notEqual(svgHash("<svg>a</svg>"), svgHash("<svg>b</svg>"));
});

test("SDK: com seletor, copia o SVG embutido com as cores aplicadas pela página", () => {
  document.body.innerHTML = `<style>.pele{fill:#f4c27a}</style>` + AVATAR;
  const r = readPageIdentity({ n: "", a: "header > div > div:nth-child(1) > div > button" }, document);
  assert.equal(r.avatar, null);
  assert.ok(r.avatarSvg?.startsWith("<svg"));
  assert.match(r.avatarSvg!, /fill:\s*(#f4c27a|rgb\(244, 194, 122\))/i); // cor vinda de classe, agora no próprio desenho
  assert.ok(!r.avatarSvg!.includes('class="pele"'));
  assert.ok(!/font-family|visibility:visible/.test(r.avatarSvg!)); // sem estilos padrão inúteis
  assert.equal(r.avatarReason, "ok");
  // sem seletor (automático), desenho solto na tela não vira avatar
  assert.equal(readPageIdentity({ n: "", a: "" }, document).avatarSvg, undefined);
});

let col: any;
before(async () => {
  Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: () => true });
  await import("../../sdk/analytics/collector");
  col = (window as any).__luumuAnalytics;
  col.boot({ api: "https://luumu.test/api/v1", key: "pk_x", host: "squad.jovensgenios.com", device: "desktop", path: () => "inicio", identity: () => ({ id: "u-9", email: null, name: null, avatar: null }), requestFlush: () => {}, capture: { n: "", a: "header button" } });
});

test("coletor: fotografa em segundo plano; o desenho vai no 1º envio, depois só a impressão", async () => {
  document.body.innerHTML = AVATAR;
  // o ambiente de teste dá 120×36 a todo botão; na tela o avatar é um quadrado
  const btn = document.querySelector("header button")!;
  btn.getBoundingClientRect = () => ({ width: 40, height: 40, x: 0, y: 0, top: 0, left: 0, right: 40, bottom: 40, toJSON: () => ({}) }) as DOMRect;
  // a fotografia roda ~2,5 s depois do boot (a tela do usuário monta depois do SDK)
  await new Promise((r) => setTimeout(r, 3000));
  const first = col.collect();
  assert.match(first.avsvgh, /^[0-9a-f]{16}$/);
  assert.ok(first.avsvg?.startsWith("<svg"));
  const realNow = Date.now;
  Date.now = () => realNow() + 20_000;
  col.event("click_x"); // alguma atividade até o próximo envio
  const second = col.collect();
  Date.now = realNow;
  assert.equal(second.avsvgh, first.avsvgh);
  assert.equal(second.avsvg, undefined);
});

test("servidor: aceita o desenho só se a impressão bater", async () => {
  const { parseAnalytics } = await import("../../lib/analytics/core");
  const now = Date.now();
  const svg = "<svg><circle r=\"3\"/></svg>";
  const base = { key: "pk_x", aid: "anon123456", sid: "sess123456", st: now, uid: "u1", pages: [{ id: "pg1", path: "home", t: now, dur: 1000, ev: [] }] };
  const ok = parseAnalytics({ ...base, avsvgh: svgHash(svg), avsvg: svg }, now)!;
  assert.equal(ok.avsvgh, svgHash(svg));
  assert.equal(ok.avsvg, svg);
  assert.equal(parseAnalytics({ ...base, avsvgh: "nao-e-hash", avsvg: svg }, now)!.avsvgh, undefined);
});
