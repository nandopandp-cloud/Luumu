/*
  Luumu.accessibility.setUser / onChange / getState (sdk/luumu.ts, core real) com um widget falso:
  setUser chamado antes de o plugin carregar é entregue quando ele sobe; id/email identificam o
  estudante; onChange recebe cada evento do plugin e pode parar de ouvir.
*/
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { installDom, sleep } from "../tours/support/dom-env";
import { normalizeA11yConfig, publicA11yConfig } from "@/lib/accessibility/config";

installDom("https://app.escola.com/inicio");
const g = globalThis as Record<string, unknown>;
const got: { setExternal: unknown[]; identify: number } = { setExternal: [], identify: 0 };
let bootCfg: { identity(): Record<string, unknown>; onEvent?(e: unknown): void } | null = null;
type L = {
  init(o: object): void;
  accessibility: { setUser(s: object): void; onChange(fn: (e: unknown) => void): () => void; getState(): unknown };
};
let L: L;

before(async () => {
  g.fetch = async (url: string) => {
    if (String(url).includes("/config")) {
      const a11y = publicA11yConfig(normalizeA11yConfig({ integration: { mode: "external", webhookUrl: "" } }));
      return new Response(JSON.stringify({ surveys: [], events: { open: false, known: [] }, host: { known: true }, tours: [], sdk: "t1", a11y, a11yWatch: true }), { status: 200 });
    }
    return new Response("{}", { status: 200 });
  };
  const head = document.head;
  const orig = head.appendChild.bind(head);
  head.appendChild = ((node: Node) => {
    const el = node as HTMLScriptElement;
    if (el.tagName === "SCRIPT") {
      if (el.src.includes("sdk-a11y.js")) {
        (window as unknown as Record<string, unknown>).__luumuA11y = {
          boot(c: typeof bootCfg) {
            bootCfg = c;
          },
          update() {},
          open() {},
          close() {},
          identify() {
            got.identify++;
          },
          destroy() {},
          setExternal(s: unknown) {
            got.setExternal.push(s);
          },
          getState: () => ({ user: { id: String(bootCfg!.identity().id) }, prefs: {}, activeProfiles: [] }),
        };
      }
      setTimeout(() => el.onload?.(new Event("load")), 0);
      return node;
    }
    return orig(node);
  }) as typeof head.appendChild;
  await import("@/sdk/luumu");
  L = (window as unknown as { Luumu: L }).Luumu;
});

test("setUser antes do plugin carregar é entregue quando ele sobe, e já identifica o estudante", async () => {
  assert.equal(L.accessibility.getState(), null, "sem plugin ainda");
  L.accessibility.setUser({ id: 42, email: "ana@escola.br", invite: true, profiles: ["leitura"] });
  L.init({ key: "pk_test" });
  await sleep(60);
  assert.ok(bootCfg, "plugin carregado");
  assert.equal(bootCfg!.identity().id, "42");
  assert.equal(bootCfg!.identity().email, "ana@escola.br");
  assert.equal(got.setExternal.length, 1);
  assert.deepEqual((got.setExternal[0] as { profiles: string[] }).profiles, ["leitura"]);
  assert.deepEqual((L.accessibility.getState() as { user: unknown }).user, { id: "42" });
});

test("setUser com o plugin já carregado vai direto; onChange ouve e para de ouvir", () => {
  L.accessibility.setUser({ id: 42, invite: false, status: "accepted" });
  assert.equal(got.setExternal.length, 2);
  const seen: unknown[] = [];
  const off = L.accessibility.onChange((e) => seen.push(e));
  bootCfg!.onEvent!({ event: "prefs.updated" });
  off();
  bootCfg!.onEvent!({ event: "prefs.updated" });
  assert.equal(seen.length, 1);
});
