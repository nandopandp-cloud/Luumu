/*
  Desligar o plugin no painel precisa tirá-lo do produto logo (sdk/luumu.ts, core real).

  O bug: o core guarda o catálogo do /config no localStorage por 30 min. Com o plugin ligado
  no catálogo guardado, cada página remontava o botão a partir dessa cópia — desligar no painel
  só valia meia hora depois. Agora um catálogo com o plugin dura 5 min.
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
  // catálogo guardado há 10 min, quando o plugin ainda estava LIGADO
  localStorage.setItem(
    "luumu_catalog_pk_test",
    JSON.stringify({ t: Date.now() - 10 * MIN, surveys: [], tours: [], a11y: publicA11yConfig(normalizeA11yConfig({})) })
  );
  // ...e no servidor ele já foi DESLIGADO
  g.fetch = async (url: string) => {
    if (String(url).includes("/config")) {
      configCalls.push(String(url));
      return new Response(JSON.stringify({ surveys: [], events: { open: false, known: [] }, host: { known: true }, tours: [], sdk: "t1", a11y: null }), { status: 200 });
    }
    return new Response("{}", { status: 200 });
  };
  const head = document.head;
  const orig = head.appendChild.bind(head);
  head.appendChild = ((node: Node) => {
    const el = node as HTMLScriptElement;
    if (el.tagName === "SCRIPT") {
      loaded.push(el.src.split("/").pop()!.split("?")[0]);
      setTimeout(() => el.onload?.(new Event("load")), 0);
      return node;
    }
    return orig(node);
  }) as typeof head.appendChild;
  await import("@/sdk/luumu");
  (window as unknown as { Luumu: { init(o: object): void } }).Luumu.init({ key: "pk_test" });
  await sleep(50);
});

test("catálogo com o plugin guardado há mais de 5 min é buscado de novo e o plugin desligado não aparece", () => {
  assert.equal(configCalls.length, 1, "buscou o /config em vez de usar a cópia de 10 min");
  assert.equal(loaded.includes("sdk-a11y.js"), false, "o plugin desligado não foi carregado");
  const saved = JSON.parse(localStorage.getItem("luumu_catalog_pk_test")!);
  assert.equal(saved.a11y, null, "a cópia guardada agora diz 'desligado'");
});
