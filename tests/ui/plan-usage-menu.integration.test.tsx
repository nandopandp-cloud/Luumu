/*
  Selo do plano + "Uso do plano" no header (components/shell/PlanUsageMenu.tsx) com React +
  happy-dom: números da workspace, percentuais, ilimitado e abrir/fechar o painel.
*/
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../tours/support/dom-env";

installDom("https://app.luumu.test/dashboard");
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
// next/link lê `self` (existe no navegador, não no Node)
(globalThis as Record<string, unknown>).self ??= globalThis;

let React: typeof import("react");
let createRoot: typeof import("react-dom/client").createRoot;
let PlanUsageMenu: typeof import("../../components/shell/PlanUsageMenu").PlanUsageMenu;
let UsageProvider: typeof import("../../components/shell/UsageProvider").UsageProvider;

before(async () => {
  React = await import("react");
  ({ createRoot } = await import("react-dom/client"));
  ({ PlanUsageMenu } = await import("../../components/shell/PlanUsageMenu"));
  ({ UsageProvider } = await import("../../components/shell/UsageProvider"));
});

const usage = {
  plan: "growth" as const,
  planLabel: "Growth",
  usage: { responses: 8, activeSurveys: 1, members: 3, events: 1234 },
  limits: { responses: 10_000, activeSurveys: Infinity, members: 10, events: Infinity },
};

async function mount() {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const initial = Promise.resolve(usage);
  await React.act(async () => {
    root.render(React.createElement(UsageProvider, { initial }, React.createElement(PlanUsageMenu)));
    await initial;
  });
  return { host, unmount: () => React.act(() => root.unmount()) };
}

test("mostra o selo do plano e abre o painel com o uso da workspace", async () => {
  const { host, unmount } = await mount();
  assert.match(host.textContent ?? "", /Growth/);
  const btn = Array.from(host.querySelectorAll("button")).find((b) => b.textContent?.includes("Uso do plano"))!;
  assert.equal(btn.getAttribute("aria-expanded"), "false");

  await React.act(async () => btn.click());
  const panel = host.querySelector("[role=dialog]")!;
  const text = panel.textContent ?? "";
  assert.match(text, /Seu plano atual/);
  assert.match(text, /8 \/ 10\.000/);
  assert.match(text, /<1%/); // 8 de 10 mil: não arredonda para "0%" com uso existente
  assert.match(text, /1 \/ ilimitado/);
  assert.match(text, /–/);
  assert.match(text, /Eventos rastreados/);
  assert.match(text, /1\.234 \/ ilimitado/);
  assert.match(text, /Ir para Plano & Cobrança/);

  await React.act(async () => void document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
  assert.equal(host.querySelector("[role=dialog]"), null);
  unmount();
});
