/*
  Seletores colados pelo cliente (lib/analytics/selectors.ts): o "Copiar seletor" do navegador
  traz IDs gerados pelo React/Radix e o combinador ">" — o primeiro precisa virar algo estável,
  o segundo precisa ser aceito. E os seletores resultantes precisam achar nome e foto na tela.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../tours/support/dom-env";
import { isSafeSelector, resolveCaptureRule, stabilizeSelector, type CaptureRule } from "../../lib/analytics/selectors";
import { readPageIdentity as readFull } from "../../sdk/analytics/page-identity";
// nome e foto (os testes de diagnóstico olham os outros campos)
const readPageIdentity = (...a: Parameters<typeof readFull>) => {
  const r = readFull(...a);
  return { name: r.name, avatar: r.avatar };
};

installDom("https://preparasp.jovensgenios.com/home");

// os seletores exatos copiados no Prepara SP (Chrome → Copiar seletor)
const NAME = String.raw`#radix-_r_9_ > div.flex.w-full.flex-col.gap-0\.5.overflow-hidden.text-left > span.truncate.font-semibold.text-sidebar-foreground.text-sm`;
const PHOTO = String.raw`#radix-_r_9_ > div.flex.w-full.items-center.justify-between > div`;

test("ID gerado pelo React/Radix vira o botão do menu; '>' é aceito; marcação não", () => {
  const n = stabilizeSelector(NAME);
  assert.ok(n.changed);
  assert.equal(n.value, String.raw`[aria-haspopup="menu"] > div.flex.w-full.flex-col.gap-0\.5.overflow-hidden.text-left > span.truncate.font-semibold.text-sidebar-foreground.text-sm`);
  assert.equal(stabilizeSelector(String.raw`#radix-\:r9\: > span`).value, '[aria-haspopup="menu"] > span');
  assert.equal(stabilizeSelector("header .user-name").changed, false);
  assert.ok(isSafeSelector(n.value));
  for (const bad of ["<script>", "a{color:red}", "x; y", "javascript:alert(1)"]) assert.ok(!isSafeSelector(bad), bad);
});

test("os seletores convertidos acham nome e foto no menu do usuário — mesmo com outro ID gerado", () => {
  // na tela seguinte o React gera outro ID (_r_k_): o seletor original quebraria, o convertido não
  document.body.innerHTML = `
    <aside><ul><li>
      <button id="radix-_r_k_" aria-haspopup="menu" data-sidebar="menu-button" class="flex">
        <div class="flex w-full items-center justify-between">
          <div><span data-slot="avatar"><img data-slot="avatar-image" src="https://files-s3.jovensgenios.com/avatar_77.png" alt=""></span></div>
        </div>
        <div class="flex w-full flex-col gap-0.5 overflow-hidden text-left">
          <span class="truncate font-semibold text-sidebar-foreground text-sm">MARIA EDUARDA LIMA</span>
          <span class="truncate text-xs">maria@al.educacao.sp.gov.br</span>
        </div>
      </button>
    </li></ul></aside>`;
  const r = readPageIdentity({ n: stabilizeSelector(NAME).value, a: stabilizeSelector(PHOTO).value }, document);
  assert.deepEqual(r, { name: "MARIA EDUARDA LIMA", avatar: "https://files-s3.jovensgenios.com/avatar_77.png" });
});

test("cada plataforma usa a própria regra; sem ela, o padrão do projeto; sem padrão, automático", () => {
  const geniex: CaptureRule[] = [
    { host: "", mode: "selectors", nameSelector: "span.nome", avatarSelector: "div.foto" },
    { host: "matematicaem.jovensgenios.com", mode: "selectors", nameSelector: "header .user", avatarSelector: "" },
    { host: "estudantes.jovensgenios.com", mode: "auto", nameSelector: "", avatarSelector: "" },
  ];
  assert.deepEqual(resolveCaptureRule(geniex, "preparasp.jovensgenios.com"), { n: "span.nome", a: "div.foto" }); // padrão do projeto
  assert.deepEqual(resolveCaptureRule(geniex, "matematicaem.jovensgenios.com"), { n: "header .user", a: "" }); // própria
  assert.deepEqual(resolveCaptureRule(geniex, "estudantes.jovensgenios.com"), { n: "", a: "" }); // própria: automático
  assert.deepEqual(resolveCaptureRule([], "squad.jovensgenios.com"), { n: "", a: "" }); // projeto sem regra (Exploradores)
  assert.deepEqual(resolveCaptureRule(geniex, ""), { n: "span.nome", a: "div.foto" }); // SDK antigo sem host
});

test("foto por seletor: otimizador do Next, srcset, <picture>, fundo por classe e SVG do aluno", () => {
  const sel = (html: string, a = "#av") => {
    document.body.innerHTML = html;
    return readFull({ n: "", a }, document);
  };
  // Next/Image: /_next/image?url=<original>
  const next = sel(`<div id="av"><img src="/_next/image?url=https%3A%2F%2Ffiles-s3.jovensgenios.com%2Fa1.png&w=64&q=75"></div>`);
  assert.equal(next.avatar, "https://files-s3.jovensgenios.com/a1.png");
  assert.equal(next.avatarFromSelector, true);
  // só srcset (sem src)
  assert.equal(sel(`<div id="av"><img srcset="https://cdn.x.com/a-1x.png 1x, https://cdn.x.com/a-2x.png 2x"></div>`).avatar, "https://cdn.x.com/a-1x.png");
  // <picture><source>
  assert.equal(sel(`<picture id="av"><source srcset="https://cdn.x.com/p.webp"></picture>`).avatar, "https://cdn.x.com/p.webp");
  // fundo vindo de CLASSE (só no estilo computado)
  assert.equal(sel(`<style>.foto{background-image:url("https://files-s3.jovensgenios.com/bg.png")}</style><div id="av"><span class="foto"></span></div>`).avatar, "https://files-s3.jovensgenios.com/bg.png");
  // avatar do aluno no Exploradores é um personagem em SVG: com seletor, vale
  assert.equal(sel(`<div id="av"><img src="https://squad.jovensgenios.com/battles/vs/astra-avatar.svg"></div>`).avatar, "https://squad.jovensgenios.com/battles/vs/astra-avatar.svg");
});

test("foto que não dá para capturar diz o porquê (Luumu.debugIdentity)", () => {
  const why = (html: string, a = "#av") => {
    document.body.innerHTML = html;
    return readFull({ n: "", a }, document).avatarReason;
  };
  assert.match(why(`<p>nada</p>`), /não encontrou/);
  assert.match(why(`<div id="av"><span>FR</span></div>`), /não tem imagem/);
  // desenho SVG embutido agora é copiado (vira imagem no painel)
  assert.equal(why(`<div id="av"><svg><circle r="4"/></svg></div>`), "ok");
  assert.match(why(`<div id="av"><img src="data:image/png;base64,AAAA"></div>`), /embutida/);
  assert.match(why(`<div id="av"><img src="http://cdn.x.com/a.png"></div>`), /https/);
});

test("servidor: foto de seletor vale mesmo sendo SVG; do automático, não", async () => {
  const { parseAnalytics } = await import("../../lib/analytics/core");
  const now = Date.now();
  const base = { key: "pk_x", aid: "anon123456", sid: "sess123456", st: now, uid: "u1", pages: [{ id: "pg1", path: "home", t: now, dur: 1000, ev: [] }] };
  const svg = "https://squad.jovensgenios.com/battles/vs/astra-avatar.svg";
  assert.equal(parseAnalytics({ ...base, avatar: svg, avsel: true }, now)!.avatar, svg);
  assert.equal(parseAnalytics({ ...base, avatar: svg }, now)!.avatar, null);
});

test("seletor de NOME tolera outra tela; o de FOTO é exato (senão casa com ícone de outra tela)", () => {
  const copied = "body > div.flex.h-full.min-h-0 > div > div > div > div > div.relative.min-h-screen > header > div > div:nth-child(1) > div > button";
  // tela com um contêiner a menos, onde o botão de VOLTAR ocupa o lugar do avatar
  document.body.innerHTML = `<div class="app"><header><div><div><div><button><svg viewBox="0 0 24 24"><path d="M19 12H5"/></svg></button></div></div></div></header></div>`;
  assert.equal(readFull({ n: "", a: copied }, document).avatarSvg, undefined); // não confunde o botão de voltar com o avatar
  assert.equal(readFull({ n: "", a: copied }, document).avatar, null);
  // o nome continua achando pelo final do seletor
  document.body.innerHTML = `<div class="app"><main><div><div class="gap"><h2>MARIA SILVA SOUZA</h2></div></div></main></div>`;
  assert.equal(readFull({ n: "body > div.x > div > div > div > main > div > div.gap > h2", a: "" }, document).name, "MARIA SILVA SOUZA");
});
