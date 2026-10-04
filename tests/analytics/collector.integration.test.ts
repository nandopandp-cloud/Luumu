/* eslint-disable @typescript-eslint/no-explicit-any -- payloads JSON inspecionados campo a campo nos testes */
/*
  Coletor de analytics (sdk/analytics/collector.ts) num navegador simulado: sessão com origem,
  telas e eventos por tela, um único envio ao sair e continuação sem nova visualização.
*/
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { installDom, sleep } from "../tours/support/dom-env";

installDom("https://app.cliente.com/cursos/42?utm_source=newsletter&utm_medium=email&utm_campaign=Volta%20as%20aulas");
const beacons: { url: string; body: string }[] = [];
let col: { boot: (c: object) => void; route: () => void; event: (n: string) => void; collect: () => Record<string, any> | null };
let path = "cursos/:id";
let uid: string | null = null;
const delivered: Record<string, any>[] = [];

before(async () => {
  Object.defineProperty(document, "referrer", { configurable: true, get: () => "https://www.google.com/search?q=x" });
  Object.defineProperty(navigator, "sendBeacon", {
    configurable: true,
    value: (url: string, blob: Blob) => {
      void blob.text().then((body) => beacons.push({ url, body }));
      return true;
    },
  });
  await import("../../sdk/analytics/collector");
  col = (window as unknown as { __luumuAnalytics: typeof col }).__luumuAnalytics;
});

const hide = async () => {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
  Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
  document.dispatchEvent(new Event("visibilitychange"));
  await sleep(20);
};
const show = () => {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
  Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
  document.dispatchEvent(new Event("visibilitychange"));
};

test("um envio com as telas da visita, eventos por tela e a origem da sessão", async () => {
  col.boot({ api: "https://luumu.test/api/v1", key: "pk_test", host: "app.cliente.com", device: "desktop", path: () => path, identity: () => ({ id: uid, email: uid ? "aluno7@escola.com" : null, name: uid ? "Aluno Sete" : null, avatar: null }), requestFlush: () => {} });
  document.dispatchEvent(new Event("pointerdown"));
  col.event("click_comecar");
  col.event("page_view_cursos"); // telas já são registradas: não viram evento
  await sleep(1100); // 1s de tempo ativo
  path = "provas";
  col.route();
  col.route(); // mesma tela: ignorado
  uid = "aluno-7";
  col.event("click_comecar");
  col.event("luumu_survey_response");
  await hide();

  // o coletor não envia sozinho: entrega ao core, que faz um envio único com os heatmaps
  assert.equal(beacons.length, 0);
  const p = col.collect()!;
  assert.equal(p.key, undefined);
  delivered.push(p);
  assert.equal(p.uid, "aluno-7");
  assert.equal(p.email, "aluno7@escola.com");
  assert.equal(p.name, "Aluno Sete");
  assert.equal(p.ref, "www.google.com");
  assert.deepEqual(p.utm, { source: "newsletter", medium: "email", campaign: "Volta as aulas" });
  assert.equal(p.landing, "cursos/:id");
  assert.deepEqual(p.pages.map((x: { path: string }) => x.path), ["cursos/:id", "provas"]);
  assert.deepEqual(p.pages[0].ev, ["click_comecar"]);
  assert.deepEqual(p.pages[1].ev, ["click_comecar", "luumu_survey_response"]);
  assert.ok(p.pages[0].dur >= 1000);
  assert.equal(p.pages[0].c, undefined);
});

test("aba volta: a tela atual continua (mesmo id, c=true), sem nova visualização", async () => {
  const first = delivered[0];
  show();
  document.dispatchEvent(new Event("pointerdown"));
  col.event("view_result");
  await sleep(1100);
  await hide();
  const p = col.collect()!;
  assert.equal(col.collect(), null, "nada pendente depois da entrega");
  assert.equal(p.sid, first.sid, "mesma sessão");
  assert.equal(p.pages.length, 1);
  assert.equal(p.pages[0].id, first.pages[1].id);
  assert.equal(p.pages[0].c, true);
  assert.deepEqual(p.pages[0].ev, ["view_result"]);
});
