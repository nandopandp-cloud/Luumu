/*
  Seletores colados pelo cliente (lib/analytics/selectors.ts): o "Copiar seletor" do navegador
  traz IDs gerados pelo React/Radix e o combinador ">" — o primeiro precisa virar algo estável,
  o segundo precisa ser aceito. E os seletores resultantes precisam achar nome e foto na tela.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../tours/support/dom-env";
import { isSafeSelector, resolveCaptureRule, stabilizeSelector, type CaptureRule } from "../../lib/analytics/selectors";
import { readPageIdentity } from "../../sdk/analytics/page-identity";

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
