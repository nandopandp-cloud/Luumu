/*
  Aba Ativação do plugin de acessibilidade (components/accessibility/ActivationTab.tsx) com
  React + happy-dom: alternar "Todos os estudantes" / "Só alguns estudantes" não pode quebrar a
  tela (relato: "dá erro e faz logout") e o aviso de "ninguém vê" acompanha a escolha.
*/
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../tours/support/dom-env";

installDom("https://app.luumu.test/accessibility");
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as Record<string, unknown>).self ??= globalThis;
// as server actions importam o cliente do banco, que exige a variável (nenhuma consulta é feita aqui)
process.env.DATABASE_URL ??= "postgres://teste:teste@localhost:5432/teste";
process.env.AUTH_SECRET ??= "segredo-de-teste";

let React: typeof import("react");
let createRoot: typeof import("react-dom/client").createRoot;
let ActivationTab: typeof import("@/components/accessibility/ActivationTab").ActivationTab;
let normalizeA11yConfig: typeof import("@/lib/accessibility/config").normalizeA11yConfig;
type Config = ReturnType<typeof import("@/lib/accessibility/config").normalizeA11yConfig>;

before(async () => {
  React = await import("react");
  ({ createRoot } = await import("react-dom/client"));
  ({ ActivationTab } = await import("@/components/accessibility/ActivationTab"));
  ({ normalizeA11yConfig } = await import("@/lib/accessibility/config"));
});

test("alternar entre todos e só alguns estudantes não quebra a aba", async () => {
  const errors: unknown[] = [];
  const onError = (e: unknown) => errors.push(e);
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host, { onUncaughtError: onError, onCaughtError: onError, onRecoverableError: onError });
  let latest: Config = normalizeA11yConfig({ scope: { hosts: ["sdacademiapro.jovensgenios.com"] } });

  function Harness() {
    const [config, setConfig] = React.useState(latest);
    latest = config;
    return React.createElement(ActivationTab, {
      config,
      patch: (fn: (c: Config) => Config) => setConfig((c) => fn(c)),
      hosts: ["sdacademiapro.jovensgenios.com", "prepara-sp.jovensgenios.com"],
      canManage: true,
      verification: { requireVerified: false, hasSecret: false },
      inviteeCount: 0,
    });
  }
  await React.act(async () => root.render(React.createElement(Harness)));

  const radio = (label: string) => [...host.querySelectorAll('[role="radio"]')].find((b) => b.textContent?.includes(label)) as HTMLElement;
  for (let i = 0; i < 3; i++) {
    await React.act(async () => radio("Só alguns estudantes").click());
    assert.equal(latest.scope.audience, "targeted");
    assert.match(host.textContent!, /ninguém vê o plugin/, "avisa que, sem grupo nem convidados, ninguém veria");
    await React.act(async () => radio("Todos os estudantes").click());
    assert.equal(latest.scope.audience, "all");
    assert.doesNotMatch(host.textContent!, /ninguém vê o plugin/);
  }
  assert.deepEqual(errors, []);
  await React.act(async () => root.unmount());
});
