/*
  Religar o plugin no painel precisa chegar ao produto logo (sdk/luumu.ts, core real).

  O bug: depois de desligado, o navegador guardava o catálogo "sem plugin" por 30 min — religar
  só valia meia hora depois. Agora o /config marca `a11yWatch` em projetos que usam o plugin, e
  esse catálogo dura 5 min mesmo com o plugin desligado.
*/
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { installDom, sleep } from "../tours/support/dom-env";
import { normalizeA11yConfig, publicA11yConfig } from "@/lib/accessibility/config";

installDom("https://app.escola.com/inicio");
const g = globalThis as Record<string, unknown>;
const loaded: string[] = [];
const configCalls: string[] = [];
const MIN = 60_000;

before(async () => {
  // catálogo guardado há 10 min, quando o plugin estava DESLIGADO num projeto que o usa
  localStorage.setItem("luumu_catalog_pk_test", JSON.stringify({ t: Date.now() - 10 * MIN, surveys: [], tours: [], a11y: null, a11yWatch: true }));
  // ...e no servidor ele já foi RELIGADO
  g.fetch = async (url: string) => {
    if (String(url).includes("/config")) {
      configCalls.push(String(url));
      return new Response(
        JSON.stringify({ surveys: [], events: { open: false, known: [] }, host: { known: true }, tours: [], sdk: "t1", a11y: publicA11yConfig(normalizeA11yConfig({})), a11yWatch: true }),
        { status: 200 }
      );
    }
    return new Response("{}", { status: 200 });
  };
  const head = document.head;
  const orig = head.appendChild.bind(head);
  head.appendChild = ((node: Node) => {
    const el = node as HTMLScriptElement;
    if (el.tagName === "SCRIPT") {
      const file = el.src.split("/").pop()!.split("?")[0];
      loaded.push(file);
      if (file === "sdk-a11y.js") (window as unknown as Record<string, unknown>).__luumuA11y = { boot() {}, update() {}, open() {}, close() {}, identify() {}, destroy() {} };
      setTimeout(() => el.onload?.(new Event("load")), 0);
      return node;
    }
    return orig(node);
  }) as typeof head.appendChild;
  await import("@/sdk/luumu");
  (window as unknown as { Luumu: { init(o: object): void } }).Luumu.init({ key: "pk_test" });
  await sleep(50);
});

test("plugin religado: a cópia 'desligado' de um projeto que usa o plugin vence em 5 min, não 30", () => {
  assert.equal(configCalls.length, 1, "buscou o /config em vez de usar a cópia de 10 min");
  assert.ok(loaded.includes("sdk-a11y.js"), "o plugin religado foi carregado");
  const saved = JSON.parse(localStorage.getItem("luumu_catalog_pk_test")!);
  assert.equal(saved.a11yWatch, true);
  assert.ok(saved.a11y, "a cópia guardada agora diz 'ligado'");
});
