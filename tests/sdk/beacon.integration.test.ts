/*
  Envio único do SDK (sdk/luumu.ts): os módulos de analytics e heatmaps entregam o que
  coletaram e o core faz UM sendBeacon por saída de página — dividido só acima do teto do
  navegador. E a amostragem: fora da amostra, o módulo de heatmaps nem é baixado.
*/
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { installDom, sleep } from "../tours/support/dom-env";

installDom("https://app.cliente.com/inicio");
const g = globalThis as Record<string, unknown>;
const beacons: { url: string; body: string }[] = [];
const loaded: string[] = [];
let heatmapVisits: Record<string, unknown>[] = [];
let config: Record<string, unknown> = {};

before(async () => {
  Object.defineProperty(navigator, "sendBeacon", {
    configurable: true,
    value: (url: string, blob: Blob) => {
      void blob.text().then((body) => beacons.push({ url, body }));
      return true;
    },
  });
  g.fetch = async (url: string) => {
    if (String(url).includes("/config")) return new Response(JSON.stringify(config), { status: 200 });
    return new Response("{}", { status: 200 });
  };
  // "baixar" um bundle = registrar o módulo falso e disparar o onload
  const head = document.head;
  const orig = head.appendChild.bind(head);
  head.appendChild = ((node: Node) => {
    const el = node as HTMLScriptElement;
    if (el.tagName === "SCRIPT") {
      const file = el.src.split("/").pop()!.split("?")[0];
      loaded.push(file);
      // o SDK procura os módulos no window do navegador (não no global do Node)
      const w = window as unknown as Record<string, unknown>;
      if (file === "sdk-analytics.js")
        w.__luumuAnalytics = { boot() {}, route() {}, event() {}, collect: () => ({ aid: "anon123456", sid: "sess123456", pages: [{ id: "p1", path: "inicio", t: Date.now(), dur: 3000, ev: [] }] }) };
      if (file === "sdk-heatmaps.js") w.__luumuHeatmaps = { boot() {}, route() {}, collect: () => heatmapVisits.splice(0) };
      setTimeout(() => el.onload?.(new Event("load")), 0);
      return node;
    }
    return orig(node);
  }) as typeof head.appendChild;
  config = { surveys: [], events: { open: false, known: [] }, host: { known: true }, tours: [], sdk: "t1", heatmaps: true, analytics: true, hmRate: 1, hmFresh: [] };
  await import("../../sdk/luumu");
});

const hide = async () => {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
  document.dispatchEvent(new Event("visibilitychange"));
  await sleep(20);
};

test("um único envio por saída de página, com analytics e heatmaps juntos", async () => {
  (window as unknown as { Luumu: { init: (o: object) => void } }).Luumu.init({ key: "pk_test" });
  await sleep(60);
  assert.ok(loaded.includes("sdk-analytics.js") && loaded.includes("sdk-heatmaps.js"));
  heatmapVisits = [{ path: "inicio", c: [], r: 1 }, { path: "provas", c: [], r: 1 }];
  await hide();
  assert.equal(beacons.length, 1, "um request só");
  assert.equal(beacons[0].url, "https://app.cliente.com/api/v1/collect");
  const b = JSON.parse(beacons[0].body);
  assert.equal(b.key, "pk_test");
  assert.equal(b.a.aid, "anon123456");
  assert.equal(b.h.length, 2);
});

test("acima do teto do sendBeacon o envio é dividido, cada parte abaixo de 60 KB", async () => {
  beacons.length = 0;
  const big = "x".repeat(25_000);
  heatmapVisits = [1, 2, 3, 4].map((i) => ({ path: `p${i}`, l: { a: big }, r: 1 }));
  await hide();
  assert.ok(beacons.length >= 3, `partes: ${beacons.length}`);
  for (const b of beacons) assert.ok(b.body.length <= 60_000, `parte com ${b.body.length} bytes`);
  const visits = beacons.flatMap((b) => JSON.parse(b.body).h ?? []);
  assert.equal(visits.length, 4, "nenhuma visita perdida na divisão");
});
