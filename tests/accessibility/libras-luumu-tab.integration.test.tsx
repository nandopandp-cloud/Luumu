/*
  Painel → Libras → Intérprete Luumu (components/accessibility/LibrasLuumu.tsx) com React +
  happy-dom: escolher a plataforma, personalizar só ela (o padrão não muda) e voltar ao padrão.
*/
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../tours/support/dom-env";

installDom("https://app.luumu.test/accessibility");
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as Record<string, unknown>).self ??= globalThis;

let React: typeof import("react");
let createRoot: typeof import("react-dom/client").createRoot;
let LibrasLuumu: typeof import("@/components/accessibility/LibrasLuumu").LibrasLuumu;
let normalizeA11yConfig: typeof import("@/lib/accessibility/config").normalizeA11yConfig;
type Config = ReturnType<typeof import("@/lib/accessibility/config").normalizeA11yConfig>;

before(async () => {
  React = await import("react");
  ({ createRoot } = await import("react-dom/client"));
  ({ LibrasLuumu } = await import("@/components/accessibility/LibrasLuumu"));
  ({ normalizeA11yConfig } = await import("@/lib/accessibility/config"));
});

test("personaliza uma plataforma sem mexer no padrão e volta ao padrão", async () => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  let latest: Config = normalizeA11yConfig({ libras: { engine: "luumu", look: { interpreter: "f11" } } });
  let selected: string | null = null;
  function Harness() {
    const [config, setConfig] = React.useState(latest);
    const [h, setH] = React.useState<string | null>(null);
    latest = config;
    selected = h;
    return React.createElement(LibrasLuumu, { config, patch: (fn: (c: Config) => Config) => setConfig((c) => fn(c)), hosts: ["escola-a.com.br", "escola-b.com.br"], host: h, onHost: setH });
  }
  await React.act(async () => root.render(React.createElement(Harness)));
  const btn = (re: RegExp) => [...host.querySelectorAll("button")].find((b) => re.test(b.textContent ?? "")) as HTMLButtonElement;
  const pick = (name: string) => [...host.querySelectorAll('[role="radio"]')].find((b) => b.textContent?.startsWith(name)) as HTMLButtonElement;

  await React.act(async () => pick("escola-a.com.br").click());
  assert.equal(selected, "escola-a.com.br");
  assert.match(host.textContent!, /usa o visual padrão/);
  await React.act(async () => btn(/Personalizar esta plataforma/).click());
  assert.ok(latest.libras.lookByHost["escola-a.com.br"], "visual próprio criado (cópia do padrão)");
  // troca o intérprete: só a plataforma muda
  const jovem = [...host.querySelectorAll('[aria-label="Intérprete"] [role="radio"]')].find((b) => /Menino negro/.test(b.textContent ?? "")) as HTMLButtonElement;
  await React.act(async () => jovem.click());
  assert.equal(latest.libras.lookByHost["escola-a.com.br"].interpreter, "jm2");
  assert.equal(latest.libras.look.interpreter, "f11", "o padrão não mudou");
  assert.match(pick("escola-a.com.br").textContent!, /próprio/);
  // padrão: edita o padrão
  await React.act(async () => pick("Padrão").click());
  const loira = [...host.querySelectorAll('[aria-label="Intérprete"] [role="radio"]')].find((b) => /Loira/.test(b.textContent ?? "")) as HTMLButtonElement;
  await React.act(async () => loira.click());
  assert.equal(latest.libras.look.interpreter, "f17");
  assert.equal(latest.libras.lookByHost["escola-a.com.br"].interpreter, "jm2", "a plataforma personalizada continua com o dela");
  // volta ao padrão
  await React.act(async () => pick("escola-a.com.br").click());
  await React.act(async () => btn(/Voltar ao padrão/).click());
  assert.equal(latest.libras.lookByHost["escola-a.com.br"], undefined);
  await React.act(async () => root.unmount());
});
