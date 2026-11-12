/*
  Plugin desligado no painel enquanto o catálogo guardado (até 5 min) ainda diz "ligado"
  (sdk/luumu.ts, core real): quando o widget ouve do servidor que o plugin está desligado
  (404 nas rotas do plugin), ele chama `onDisabled` e o core tira o plugin da página e
  descarta o catálogo guardado — a página seguinte já não remonta o botão.
*/
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { installDom, sleep } from "../tours/support/dom-env";
import { normalizeA11yConfig, publicA11yConfig } from "@/lib/accessibility/config";

installDom("https://app.escola.com/inicio");
const g = globalThis as Record<string, unknown>;
const loaded: string[] = [];
let bootCfg: { onDisabled?: () => void; config?: unknown } | null = null;
let destroyed = 0;

before(async () => {
  // catálogo de 1 min atrás, ainda válido, com o plugin ligado
  localStorage.setItem(
    "luumu_catalog_pk_test",
    JSON.stringify({ t: Date.now() - 60_000, surveys: [], tours: [], a11y: publicA11yConfig(normalizeA11yConfig({})) })
  );
  g.fetch = async () => new Response("{}", { status: 200 });
  const head = document.head;
  const orig = head.appendChild.bind(head);
  head.appendChild = ((node: Node) => {
    const el = node as HTMLScriptElement;
    if (el.tagName === "SCRIPT") {
      const file = el.src.split("/").pop()!.split("?")[0];
      loaded.push(file);
      if (file === "sdk-a11y.js")
        (window as unknown as Record<string, unknown>).__luumuA11y = {
          boot: (c: typeof bootCfg) => (bootCfg = c),
          update() {},
          open() {},
          close() {},
          destroy: () => destroyed++,
        };
      setTimeout(() => el.onload?.(new Event("load")), 0);
      return node;
    }
    return orig(node);
  }) as typeof head.appendChild;
  await import("@/sdk/luumu");
  (window as unknown as { Luumu: { init(o: object): void } }).Luumu.init({ key: "pk_test" });
  await sleep(50);
});

test("catálogo recente com o plugin: o widget é montado e recebe o aviso de desligamento", () => {
  assert.ok(loaded.includes("sdk-a11y.js"));
  assert.equal(typeof bootCfg?.onDisabled, "function");
});

test("servidor diz 'desligado': o plugin sai da página e o catálogo guardado é descartado", () => {
  bootCfg!.onDisabled!();
  assert.equal(destroyed, 1, "widget desmontado (página volta como era)");
  assert.equal(localStorage.getItem("luumu_catalog_pk_test"), null, "a próxima página busca o /config de novo");
});
