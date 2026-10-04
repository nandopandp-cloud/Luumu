/* eslint-disable @typescript-eslint/no-explicit-any -- payloads JSON inspecionados campo a campo nos testes */
/*
  Gravador de heatmaps (sdk/heatmaps/recorder.ts) num navegador simulado (happy-dom): cliques
  ancorados no elemento, seletor que acha o elemento de novo, envio por sendBeacon e a cópia
  da página sem scripts, sem valores de campos e com dados pessoais mascarados.
*/
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { installDom, sleep } from "../tours/support/dom-env";

installDom("https://app.cliente.com/cursos/42");
const g = globalThis as Record<string, unknown>;
const beacons: { url: string; body: string }[] = [];
let rec: { boot: (c: object) => void; route: () => void; collect: () => Record<string, unknown>[] };
let flushRequests = 0;
let path = "cursos/:id";
let selectorOf: (el: Element) => string;
let serializePage: (d?: Document) => string;

before(async () => {
  document.body.innerHTML = `
    <header><nav><a href="/" id="logo">Luumu</a><a href="/precos">Preços</a></nav></header>
    <main>
      <h1>Bem-vindo, ana@cliente.com</h1>
      <p>CPF 123.456.789-00</p>
      <div data-luumu-mask><span>Saldo R$ 1.234</span></div>
      <form><input name="email" value="ana@cliente.com" /><input type="password" value="segredo" /><textarea>texto livre</textarea>
      <button type="submit" data-rect="200,300,160,40"><span class="ico">→</span> Começar agora</button></form>
      <script>alert(1)</script>
      <img src="/logo.png" onerror="alert(2)" loading="lazy" />
    </main>`;
  Object.defineProperty(navigator, "sendBeacon", {
    configurable: true,
    value: (url: string, blob: Blob) => {
      void blob.text().then((body) => beacons.push({ url, body }));
      return true;
    },
  });
  g.fetch = async () => new Response(JSON.stringify({ need: false }), { status: 200 });
  await import("../../sdk/heatmaps/recorder");
  ({ selectorOf, serializePage } = await import("../../sdk/heatmaps/recorder"));
  rec = (window as unknown as { __luumuHeatmaps: typeof rec }).__luumuHeatmaps;
});

test("seletor acha o mesmo elemento de novo (nth-of-type e id estável)", () => {
  const btn = document.querySelector("button")!;
  const links = document.querySelectorAll("nav a");
  for (const el of [btn, links[0], links[1]]) {
    const sel = selectorOf(el);
    assert.equal(document.querySelector(sel), el, sel);
  }
  assert.equal(selectorOf(links[0]), "#logo");
});

test("clique no ícone conta no botão, com a posição dentro dele; a visita vai para o envio único", async () => {
  rec.boot({
    api: "https://luumu.test/api/v1",
    key: "pk_test",
    host: "app.cliente.com",
    device: "desktop",
    path: () => path,
    rate: 0.25,
    fresh: ["desktop|cursos/:id"], // já tem cópia: não pergunta ao servidor
    requestFlush: () => flushRequests++,
  });
  window.dispatchEvent(new Event("load"));
  await sleep(10);

  const icon = document.querySelector("button .ico")!;
  // clique a 25% da largura e no meio da altura do botão (200,300,160x40)
  icon.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 240, clientY: 320 }));
  document.querySelector("nav a:nth-of-type(2)")!.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 110, clientY: 110 }));
  await sleep(1100); // ao menos 1s de tempo ativo

  // o gravador não envia sozinho: entrega ao core (que junta com o analytics num request)
  assert.equal(beacons.length, 0);
  const out = rec.collect();
  assert.equal(out.length, 1);
  const p = out[0] as Record<string, any>;
  assert.equal(p.r, 0.25);
  assert.equal(p.key, undefined); // key e host vão uma vez só, no envelope do core
  assert.equal(p.path, "cursos/:id");
  assert.equal(p.c.length, 2);
  const [sel, x, y] = p.c[0];
  assert.equal(document.querySelector(sel), document.querySelector("button"));
  assert.deepEqual([x, y], [250, 500]);
  assert.equal(p.p.length, 2); // caminho: botão ⟶ Preços
  assert.match(p.l[sel], /Começar agora/);
  assert.ok(p.dur >= 1000);
  assert.ok(!JSON.stringify(p).includes("segredo"));

  // troca de rota numa SPA: fecha a visita na fila, SEM request
  path = "precos";
  rec.route();
  assert.equal(beacons.length, 0);
});

test("cópia da página: sem scripts, sem valores digitados, dados pessoais mascarados", () => {
  const html = serializePage();
  assert.match(html, /^<!DOCTYPE html>/);
  assert.ok(!/<script/i.test(html), "script removido");
  assert.ok(!/onerror/i.test(html), "handler removido");
  assert.ok(!html.includes("segredo") && !html.includes('value="ana@cliente.com"'), "valores de campo removidos");
  assert.ok(!html.includes("texto livre"), "textarea esvaziada");
  assert.ok(!html.includes("ana@cliente.com"), "e-mail no texto mascarado");
  assert.ok(!html.includes("123.456.789-00"), "CPF mascarado");
  assert.ok(!html.includes("1.234") && html.includes("•••••"), "área data-luumu-mask mascarada");
  assert.match(html, /<head><base href="https:\/\/app\.cliente\.com\//); // URLs relativas valem a partir do site
  assert.match(html, /loading="eager"/);
  assert.match(html, /Começar agora/); // o resto do conteúdo continua
});

test("app que rola dentro do <body>: a profundidade é a do painel, não 100% da janela", async () => {
  const body = document.body;
  // janela do tamanho da tela; quem rola é o body (overflow:auto), com 4x a altura
  body.style.overflowY = "auto";
  body.setAttribute("data-rect", "0,0,1280,800");
  Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, value: 800 });
  Object.defineProperty(body, "clientHeight", { configurable: true, value: 800 });
  Object.defineProperty(body, "scrollHeight", { configurable: true, value: 3200 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
  let top = 0;
  Object.defineProperty(body, "scrollTop", { configurable: true, get: () => top });

  path = "trilha";
  rec.route(); // nova visita
  top = 800; // rolou até 50% do conteúdo (800 + 800 de 3200)
  body.dispatchEvent(new Event("scroll"));
  await sleep(30);
  document.querySelector("nav a")!.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 110, clientY: 110 }));
  await sleep(1100);
  const visits = rec.collect();
  const p = visits[visits.length - 1] as Record<string, any>;
  assert.equal(p.sd, 50);
  assert.equal(p.dh, 3200 + 0); // altura do conteúdo do painel, não a da janela
});
