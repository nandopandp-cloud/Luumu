/*
  Aba Convite (components/accessibility/tabs.tsx → NudgeTab) com React + happy-dom: no modo
  plataforma externa, a lista de convidados, "Quem mais recebe" e a frequência saem de cena (quem
  decide é o setUser da plataforma); no modo Luumu, um atalho troca o modo sem ir à aba Ativação.
*/
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../tours/support/dom-env";

installDom("https://app.luumu.test/accessibility");
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as Record<string, unknown>).self ??= globalThis;
process.env.DATABASE_URL ??= "postgres://teste:teste@localhost:5432/teste";
process.env.AUTH_SECRET ??= "segredo-de-teste";

let React: typeof import("react");
let createRoot: typeof import("react-dom/client").createRoot;
let NudgeTab: typeof import("@/components/accessibility/tabs").NudgeTab;
let AppRouterContext: typeof import("next/dist/shared/lib/app-router-context.shared-runtime").AppRouterContext;
let normalizeA11yConfig: typeof import("@/lib/accessibility/config").normalizeA11yConfig;
type Config = ReturnType<typeof import("@/lib/accessibility/config").normalizeA11yConfig>;

before(async () => {
  React = await import("react");
  ({ createRoot } = await import("react-dom/client"));
  ({ NudgeTab } = await import("@/components/accessibility/tabs"));
  ({ normalizeA11yConfig } = await import("@/lib/accessibility/config"));
  ({ AppRouterContext } = await import("next/dist/shared/lib/app-router-context.shared-runtime"));
});

test("modo Luumu → 'Usar plataforma externa' esconde lista, grupos e frequência; mensagem continua", async () => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host, { onCaughtError: () => {}, onRecoverableError: () => {} });
  let latest: Config = normalizeA11yConfig({ nudge: { enabled: true } });
  function Harness() {
    const [config, setConfig] = React.useState(latest);
    latest = config;
    return React.createElement(NudgeTab, { config, patch: (fn: (c: Config) => Config) => setConfig((c) => fn(c)), canManage: true, inviteeCount: 7 });
  }
  // os componentes do painel usam useRouter; aqui um roteador que não navega
  const router = { push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {}, hmrRefresh() {} };
  await React.act(async () => root.render(React.createElement(AppRouterContext.Provider, { value: router as never }, React.createElement(Harness))));
  assert.match(host.textContent!, /Quem mais recebe/);
  assert.match(host.textContent!, /Frequência/);
  assert.match(host.textContent!, /Importar em lote/);

  const btn = [...host.querySelectorAll("button")].find((b) => b.textContent === "Usar plataforma externa") as HTMLButtonElement;
  assert.ok(btn, "atalho para trocar o modo");
  await React.act(async () => btn.click());
  assert.equal(latest.integration.mode, "external");
  const text = host.textContent!;
  assert.doesNotMatch(text, /Quem mais recebe/);
  assert.doesNotMatch(text, /Frequência/);
  assert.doesNotMatch(text, /Importar em lote/);
  assert.match(text, /Controlados pela plataforma externa/);
  assert.match(text, /Botão principal/, "mensagem e botões continuam editáveis");
  assert.equal(host.querySelector("button")?.textContent === "Usar plataforma externa", false);
  await React.act(async () => root.unmount());
});
