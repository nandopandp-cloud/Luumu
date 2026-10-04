/*
  Nome e foto lidos da página do produto (sdk/analytics/page-identity.ts): detecção automática
  nos formatos comuns de menu de usuário, seletores configurados e o que NÃO pode ser capturado.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../tours/support/dom-env";
import { readPageIdentity, looksLikeName } from "../../sdk/analytics/page-identity";

installDom("https://preparasp.jovensgenios.com/home");
const AUTO = { n: "", a: "" };
const page = (html: string) => {
  document.body.innerHTML = html;
  return readPageIdentity(AUTO, document);
};

test("nome com cara de nome; rótulos de interface, e-mail e números não", () => {
  assert.equal(looksLikeName("  Ana   Souza "), "Ana Souza");
  assert.equal(looksLikeName("João D'Ávila-Lima"), "João D'Ávila-Lima");
  for (const no of ["Minha conta", "Perfil", "ana@escola.com", "Aluno 123", "", "Sair", "x"]) assert.equal(looksLikeName(no), null, no);
});

test("automático: avatar do Radix (shadcn) no topo, nome no alt", () => {
  const r = page(`<header><button aria-haspopup="menu"><span data-slot="avatar"><img data-slot="avatar-image" src="/uploads/u/42.png" alt="Ana Souza"></span></button></header>`);
  assert.deepEqual(r, { name: "Ana Souza", avatar: "https://preparasp.jovensgenios.com/uploads/u/42.png" });
});

test("automático: nome no texto do menu do usuário, ignorando as iniciais", () => {
  const r = page(`<nav><button class="user-menu"><span class="avatar"><img src="https://cdn.jg.com/a.jpg" alt="avatar"><span>AS</span></span><span>Ana Souza</span><small>Aluno</small></button></nav>`);
  assert.equal(r.name, "Ana Souza");
  assert.equal(r.avatar, "https://cdn.jg.com/a.jpg");
});

test("automático: prefere a foto do topo/menu à de um card no conteúdo", () => {
  const r = page(`<main><img class="avatar" src="https://cdn.jg.com/professor.jpg" alt="Prof. Carlos"></main><aside><a class="profile"><img class="avatar" src="https://cdn.jg.com/me.jpg" alt="Bia Lima"></a></aside>`);
  assert.equal(r.avatar, "https://cdn.jg.com/me.jpg");
  assert.equal(r.name, "Bia Lima");
});

test("sem foto de perfil na tela: nada; data-luumu-name explícito ainda vale", () => {
  assert.deepEqual(page(`<header><a href="/">Início</a></header>`), { name: null, avatar: null });
  assert.equal(page(`<span data-luumu-name="Carla Mendes"></span>`).name, "Carla Mendes");
});

test("seletores configurados vencem a detecção; http/data: não viram foto", () => {
  document.body.innerHTML = `<div id="nm">Pedro Alves</div><div id="ph" style="background-image:url('https://cdn.jg.com/p.png')"></div><img class="avatar" src="http://inseguro.com/x.png">`;
  assert.deepEqual(readPageIdentity({ n: "#nm", a: "#ph" }, document), { name: "Pedro Alves", avatar: "https://cdn.jg.com/p.png" });
  assert.equal(page(`<img class="avatar" src="http://inseguro.com/x.png" alt="Ana Souza">`).avatar, null);
  assert.equal(page(`<img class="avatar" src="data:image/png;base64,AAAA" alt="Ana Souza">`).avatar, null);
});

test("seletor inválido não quebra o produto do cliente", () => {
  document.body.innerHTML = `<p>oi</p>`;
  assert.deepEqual(readPageIdentity({ n: "[[[", a: ":::" }, document), { name: null, avatar: null });
});
