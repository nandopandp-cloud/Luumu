/*
  Ambiente de DOM para os testes de integração (happy-dom). Expõe as globais que o código do
  SDK usa e simula layout: happy-dom não calcula caixas, então todo elemento visível ganha um
  retângulo (ou o de `data-rect="x,y,w,h"`), e `display:none`/`hidden` viram caixa vazia.
*/
import { Window } from "happy-dom";

export function installDom(url = "https://app.cliente.com/dashboard") {
  const win = new Window({ url, width: 1280, height: 800 });
  const g = globalThis as Record<string, unknown>;
  const keys = [
    "window", "document", "location", "history", "navigator", "localStorage", "sessionStorage",
    "getComputedStyle", "MutationObserver", "HTMLElement", "Element", "Node", "Event", "CustomEvent",
    "KeyboardEvent", "MouseEvent", "PointerEvent", "Blob", "CSS", "innerWidth", "innerHeight",
  ];
  for (const k of keys) {
    const v = k === "window" ? win : (win as unknown as Record<string, unknown>)[k];
    // funções globais (getComputedStyle) precisam do `this` da janela; construtores não
    const value = typeof v === "function" && /^[a-z]/.test(k) ? (v as (...a: unknown[]) => unknown).bind(win) : v;
    Object.defineProperty(g, k, { value, configurable: true, writable: true });
  }
  g.requestAnimationFrame = (cb: (t: number) => void) => setTimeout(() => cb(Date.now()), 0) as unknown as number;
  g.cancelAnimationFrame = (id: number) => clearTimeout(id);
  (win as unknown as Record<string, unknown>).requestAnimationFrame = g.requestAnimationFrame;

  const proto = (win as unknown as { Element: { prototype: Element } }).Element.prototype;
  proto.getBoundingClientRect = function (this: Element) {
    if (hiddenUp(this)) return rect(0, 0, 0, 0);
    const r = this.getAttribute("data-rect");
    if (r) {
      const [x, y, w, h] = r.split(",").map(Number);
      return rect(x, y, w, h);
    }
    return rect(100, 100, 120, 36);
  } as Element["getBoundingClientRect"];
  (proto as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
  return win;
}

function hiddenUp(el: Element | null): boolean {
  for (let cur = el; cur; cur = cur.parentElement) {
    if (cur.hasAttribute?.("hidden") || (cur as HTMLElement).style?.display === "none") return true;
  }
  return false;
}

function rect(x: number, y: number, width: number, height: number): DOMRect {
  return { x, y, width, height, left: x, top: y, right: x + width, bottom: y + height, toJSON() {} } as DOMRect;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
