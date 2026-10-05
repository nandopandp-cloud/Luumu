/*
  Tour automático não abre por cima de um modal do site (ex.: vídeo de boas-vindas do Preparasp,
  um Radix Dialog): espera ele fechar. Balão pequeno com role=dialog e UI da Luumu não contam.
*/
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "./support/dom-env";

installDom("https://preparasp.jovensgenios.com/home");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let blockingModal: typeof import("../../sdk/shared/dom").blockingModal;
let whenScreenFree: typeof import("../../sdk/shared/dom").whenScreenFree;
before(async () => {
  ({ blockingModal, whenScreenFree } = await import("../../sdk/shared/dom"));
});

function rect(el: Element, w: number, h: number) {
  (el as HTMLElement).getBoundingClientRect = () => ({ width: w, height: h, top: 0, left: 0, right: w, bottom: h, x: 0, y: 0, toJSON() {} }) as DOMRect;
}
function videoModal() {
  const el = document.createElement("div");
  el.setAttribute("role", "dialog");
  el.setAttribute("data-state", "open");
  el.setAttribute("data-slot", "dialog-content");
  rect(el, window.innerWidth * 0.7, window.innerHeight * 0.8);
  document.body.appendChild(el);
  return el;
}

test("modal grande do site aberto bloqueia; fechado (data-state=closed ou removido) libera", () => {
  document.body.innerHTML = "";
  const m = videoModal();
  assert.equal(blockingModal(), m);
  m.setAttribute("data-state", "closed");
  assert.equal(blockingModal(), null);
  m.remove();
  assert.equal(blockingModal(), null);
});

test("balão pequeno com role=dialog e UI da Luumu não bloqueiam", () => {
  document.body.innerHTML = "";
  const chat = document.createElement("div");
  chat.setAttribute("role", "dialog");
  rect(chat, 220, 60);
  document.body.appendChild(chat);
  const luumu = document.createElement("div");
  luumu.setAttribute("data-luumu-ui", "survey");
  const inner = document.createElement("div");
  inner.setAttribute("role", "dialog");
  rect(inner, window.innerWidth, window.innerHeight);
  luumu.appendChild(inner);
  document.body.appendChild(luumu);
  assert.equal(blockingModal(), null);
});

test("tela livre: roda na hora", () => {
  document.body.innerHTML = "";
  let ran = 0;
  whenScreenFree(() => ran++);
  assert.equal(ran, 1);
});

test("com o vídeo aberto, espera; ao fechar, roda uma vez só", async () => {
  document.body.innerHTML = "";
  const m = videoModal();
  let ran = 0;
  whenScreenFree(() => ran++, 50);
  await sleep(120);
  assert.equal(ran, 0);
  m.setAttribute("data-state", "closed");
  await sleep(30);
  assert.equal(ran, 0); // ainda na animação de saída
  m.remove();
  await sleep(120);
  assert.equal(ran, 1);
  document.body.appendChild(document.createElement("p"));
  await sleep(120);
  assert.equal(ran, 1);
});

test("fecha um modal e outro abre logo em seguida: continua esperando", async () => {
  document.body.innerHTML = "";
  const a = videoModal();
  let ran = 0;
  whenScreenFree(() => ran++, 60);
  a.remove();
  const b = videoModal();
  await sleep(150);
  assert.equal(ran, 0);
  b.remove();
  await sleep(150);
  assert.equal(ran, 1);
});
