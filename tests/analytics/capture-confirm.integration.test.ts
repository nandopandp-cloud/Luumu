/* eslint-disable @typescript-eslint/no-explicit-any -- payloads JSON inspecionados campo a campo */
/*
  Captura automática no coletor: um nome/foto só vai ao painel depois de aparecer IGUAL em duas
  telas diferentes (o perfil fica fixo; ranking/card de colega muda de tela). Confirmado, fica
  guardado e vai nas próximas visitas.
*/
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../tours/support/dom-env";

installDom("https://preparasp.jovensgenios.com/home");
let col: { boot: (c: object) => void; route: () => void; collect: () => Record<string, any> | null };
let path = "home";
const header = `<header><button aria-haspopup="menu"><span data-slot="avatar"><img data-slot="avatar-image" src="https://files-s3.jovensgenios.com/avatar_123.png" alt="Ana Souza"></span></button></header>`;

before(async () => {
  Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: () => true });
  await import("../../sdk/analytics/collector");
  col = (window as any).__luumuAnalytics;
  col.boot({ api: "https://luumu.test/api/v1", key: "pk_x", host: "preparasp.jovensgenios.com", device: "desktop", path: () => path, identity: () => ({ id: "u-1", email: "ana@escola.com", name: null, avatar: null }), requestFlush: () => {}, capture: { n: "", a: "" } });
});

const flush = (route: string, html: string) => {
  path = route;
  document.body.innerHTML = html;
  col.route();
  // as telas precisam de algum tempo ativo para irem no envio
  const p = col.collect();
  return p;
};

test("1ª tela: ainda não envia; 2ª tela com o mesmo perfil: envia; personagem do ranking nunca", async () => {
  const card = `<main><div class="ranking"><img class="avatar" src="https://files-s3.jovensgenios.com/avatar_999.png" alt="Bruno Lima"></div></main>`;
  const first = flush("home", header + card);
  assert.equal(first?.name ?? null, null);
  assert.equal(first?.avatar ?? null, null);
  // a varredura espera 15s entre leituras: simula o tempo passando
  const realNow = Date.now;
  Date.now = () => realNow() + 20_000;
  const second = flush("quiz/:id", header);
  Date.now = realNow;
  assert.equal(second?.name, "Ana Souza");
  assert.equal(second?.avatar, "https://files-s3.jovensgenios.com/avatar_123.png");
  // confirmado fica guardado para a pessoa
  assert.equal(JSON.parse(localStorage.getItem("luumu_idc_ok")!).name, "Ana Souza");
});
