/*
  Busca ⌘K (components/search) renderizada com React + happy-dom: atalho, busca no servidor
  (fetch simulado), grupos, destaque, teclado, filtros e abrir resultado.
*/
import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../tours/support/dom-env";

installDom("https://app.luumu.test/dashboard");
const g = globalThis as Record<string, unknown>;
g.IS_REACT_ACT_ENVIRONMENT = true;
g.self ??= globalThis;
// a prévia importa a server action de respostas (que lê estas variáveis ao carregar)
process.env.AUTH_SECRET ||= "test-secret";
process.env.DATABASE_URL ||= "postgres://u:p@localhost/test";

let React: typeof import("react");
let createRoot: typeof import("react-dom/client").createRoot;
let SearchProvider: typeof import("../../components/search/SearchProvider").SearchProvider;
let AppRouterContext: React.Context<unknown>;

const pushed: string[] = [];
const queries: string[] = [];
const RESULTS = {
  project: { id: "p1", name: "Geniex" },
  surveys: [{ id: "s1", name: "Pesquisa de Satisfação", type: "CSAT", status: "ativa", responses: 42, updatedAt: new Date().toISOString() }],
  responses: [
    { id: "r1", surveyId: "s1", surveyName: "Pesquisa de Satisfação", comment: "A satisfação caiu porque o app está lento", respondent: "ana@x.com", score: 2, sentiment: "negativo", createdAt: new Date().toISOString() },
  ],
  tours: [],
};

before(async () => {
  React = await import("react");
  ({ createRoot } = await import("react-dom/client"));
  ({ SearchProvider } = await import("../../components/search/SearchProvider"));
  ({ AppRouterContext } = (await import("next/dist/shared/lib/app-router-context.shared-runtime")) as unknown as { AppRouterContext: React.Context<unknown> });
});

beforeEach(() => {
  pushed.length = 0;
  queries.length = 0;
  g.fetch = async (url: string) => {
    const q = new URL(url, "https://app.luumu.test").searchParams.get("q") ?? "";
    queries.push(q);
    return new Response(JSON.stringify({ query: q, ...RESULTS }), { status: 200, headers: { "content-type": "application/json" } });
  };
});

const router = { push: (h: string) => pushed.push(h), replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const key = (k: string, extra: KeyboardEventInit = {}) =>
  React.act(async () => void document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, ...extra })));

async function mount() {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await React.act(async () =>
    root.render(React.createElement(AppRouterContext.Provider, { value: router }, React.createElement(SearchProvider, { projectName: "Geniex" })))
  );
  return () => React.act(() => root.unmount());
}

async function type(text: string) {
  const input = document.querySelector("[role=dialog] input") as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor((window as unknown as { HTMLInputElement: typeof HTMLInputElement }).HTMLInputElement.prototype, "value")!.set!;
  await React.act(async () => {
    setter.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await React.act(async () => wait(320)); // debounce (250 ms) + resposta
}

test("⌘K abre; sem termo mostra ações e páginas; Esc fecha", async () => {
  const unmount = await mount();
  assert.equal(document.querySelector("[role=dialog]"), null);
  await React.act(async () => void window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true })));
  const dialog = document.querySelector("[role=dialog]")!;
  assert.ok(dialog);
  assert.equal(document.activeElement?.tagName, "INPUT");
  assert.match(dialog.textContent ?? "", /Ações rápidas/);
  assert.match(dialog.textContent ?? "", /Buscando em\s*Geniex/);
  assert.equal(queries.length, 0); // nada vai ao servidor sem termo
  await key("Escape");
  assert.equal(document.querySelector("[role=dialog]"), null);
  await unmount();
});

test("busca, agrupa, destaca, navega com setas e abre com Enter", async () => {
  const unmount = await mount();
  await React.act(async () => void window.dispatchEvent(new KeyboardEvent("keydown", { key: "/" })));
  await type("satisfacao");
  assert.deepEqual(queries, ["satisfacao"]);

  const dialog = document.querySelector("[role=dialog]")!;
  const groups = Array.from(dialog.querySelectorAll("[role=group]")).map((g) => g.getAttribute("aria-label"));
  assert.deepEqual(groups.slice(0, 2), ["Pesquisas", "Respostas"]);
  assert.equal(dialog.querySelector("mark")?.textContent, "Satisfação"); // sem acento casa com acento

  const options = () => Array.from(dialog.querySelectorAll("[role=option]"));
  assert.equal(options()[0].getAttribute("aria-selected"), "true");
  await key("ArrowDown");
  assert.equal(options()[1].getAttribute("aria-selected"), "true");
  assert.match(options()[1].textContent ?? "", /app está lento/);

  await key("Enter");
  assert.deepEqual(pushed, ["/responses?surveyId=s1"]);
  assert.equal(document.querySelector("[role=dialog]"), null);
  await unmount();
});

test("Tab troca o filtro e mostra só aquele tipo", async () => {
  const unmount = await mount();
  await React.act(async () => void window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true })));
  await type("satisfacao");
  await key("Tab"); // Pesquisas
  const dialog = document.querySelector("[role=dialog]")!;
  assert.equal(dialog.querySelector("[role=tab][aria-selected=true]")?.textContent?.replace(/\d+/g, "").trim(), "Pesquisas");
  const groups = Array.from(dialog.querySelectorAll("[role=group]")).map((g) => g.getAttribute("aria-label"));
  assert.deepEqual(groups, ["Pesquisas"]);
  await key("Enter");
  assert.deepEqual(pushed, ["/surveys/s1/responses"]); // pesquisa ativa abre nos resultados
  await unmount();
});
