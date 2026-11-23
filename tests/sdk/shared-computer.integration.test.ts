/* eslint-disable @typescript-eslint/no-explicit-any -- payloads JSON inspecionados campo a campo */
/*
  Computador compartilhado (sdk/luumu.ts + coletor de analytics de verdade): quando outro
  estudante faz login, o que estava pendente sai em nome do anterior e o novo ganha ID e sessão
  próprios. A mesma pessoa saindo e voltando continua com o mesmo ID.
*/
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { installDom, sleep } from "../tours/support/dom-env";

installDom("https://app.cliente.com/inicio");
const g = globalThis as Record<string, unknown>;
const beacons: any[] = [];
type L = { init: (o: object) => void; identify: (u: object) => void; reset: () => void };
let L: L;

before(async () => {
  Object.defineProperty(navigator, "sendBeacon", {
    configurable: true,
    value: (_url: string, blob: Blob) => {
      void blob.text().then((body) => beacons.push(JSON.parse(body)));
      return true;
    },
  });
  g.fetch = async (url: string) => {
    const config = { surveys: [], events: { open: false, known: [] }, host: { known: true }, tours: [], sdk: "t1", analytics: true };
    return new Response(JSON.stringify(String(url).includes("/config") ? config : {}), { status: 200 });
  };
  const head = document.head;
  const orig = head.appendChild.bind(head);
  head.appendChild = ((node: Node) => {
    const el = node as HTMLScriptElement;
    if (el.tagName === "SCRIPT") {
      const file = el.src.split("/").pop()!.split("?")[0];
      // o coletor real: ele se registra no window ao ser importado
      if (file === "sdk-analytics.js") void import("@/sdk/analytics/collector").then(() => el.onload?.(new Event("load")));
      else setTimeout(() => el.onerror?.(new Event("error")), 0);
      return node;
    }
    return orig(node);
  }) as typeof head.appendChild;
  localStorage.setItem("luumu_anon", "lab01computador");
  await import("@/sdk/luumu");
  L = (window as unknown as { Luumu: L }).Luumu;
  L.init({ key: "pk_test" });
  await sleep(80);
});

const flushMicro = () => sleep(20);
const hide = async () => {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
  document.dispatchEvent(new Event("visibilitychange"));
  await flushMicro();
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
};
const anon = () => localStorage.getItem("luumu_anon");

test("outro estudante faz login: o pendente sai em nome do anterior; o novo tem ID e sessão próprios", async () => {
  L.identify({ id: "alice", email: "alice@escola.com" });
  assert.equal(anon(), "lab01computador", "a primeira estudante fica com o ID do computador");
  document.dispatchEvent(new Event("pointerdown"));
  await sleep(1100);

  L.identify({ id: "bruno", email: "bruno@escola.com" });
  await flushMicro();
  assert.equal(beacons.length, 1, "o que a Alice fez saiu antes da troca");
  assert.equal(beacons[0].a.uid, "alice");
  assert.equal(beacons[0].a.aid, "lab01computador");
  const aliceSession = beacons[0].a.sid;
  assert.notEqual(anon(), "lab01computador", "o Bruno ganhou um ID próprio");

  document.dispatchEvent(new Event("pointerdown"));
  await sleep(1100);
  await hide();
  const b = beacons[1].a;
  assert.equal(b.uid, "bruno");
  assert.equal(b.aid, anon());
  assert.notEqual(b.sid, aliceSession, "sessão nova: a do Bruno não é a continuação da sessão da Alice");
});

test("logout e login da mesma pessoa mantêm o ID; quem volta ao computador recupera o seu", async () => {
  const brunoId = anon();
  L.reset();
  L.identify({ id: "bruno", email: "bruno@escola.com" });
  assert.equal(anon(), brunoId);
  L.identify({ id: "alice", email: "alice@escola.com" });
  assert.equal(anon(), "lab01computador");
  // a impressão digital, nunca o e-mail, fica guardada no navegador
  assert.ok(!(localStorage.getItem("luumu_anon_owner") ?? "").includes("alice"));
});
