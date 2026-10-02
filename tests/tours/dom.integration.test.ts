import { test, before } from "node:test";
import assert from "node:assert/strict";
import { installDom, sleep } from "./support/dom-env";

installDom();
// importados depois do ambiente existir
let dom: typeof import("../../sdk/shared/dom");
let discovery: typeof import("../../sdk/builder/discovery");
before(async () => {
  dom = await import("../../sdk/shared/dom");
  discovery = await import("../../sdk/builder/discovery");
});

const page = (html: string) => {
  document.body.innerHTML = html;
};

test("discovery: só elementos interativos, sem senha, sem ocultos, sem a própria Luumu e sem aninhados", () => {
  page(`
    <nav><a href="/dashboard">Dashboard</a><a href="/projects">Projetos</a></nav>
    <main>
      <button class="btn-primary"><svg></svg><span>Criar projeto</span></button>
      <button data-luumu-id="export-report" data-luumu-name="Exportar relatório">⇩</button>
      <input type="password" name="pwd" />
      <input type="email" name="email" placeholder="Seu e-mail" value="segredo@cliente.com" />
      <button hidden>Escondido</button>
      <div data-luumu-ui="tour"><button>Próximo</button></div>
    </main>`);
  const r = discovery.discover();
  const labels = r.elements.map((e) => e.label);
  assert.deepEqual(labels.sort(), ["Criar projeto", "Dashboard", "Exportar relatório", "Projetos", "Seu e-mail"].sort());
  // nunca lê o valor digitado
  assert.ok(!JSON.stringify(r.elements).includes("segredo@cliente.com"));
  const nav = r.elements.find((e) => e.label === "Projetos")!;
  assert.equal(nav.kind, "navigation");
  assert.equal(nav.href, "/projects");
  const exp = r.elements.find((e) => e.luumuId === "export-report")!;
  assert.equal(exp.strategy, "luumu-id");
  assert.equal(exp.stability, 1);
});

test("resolução resiliente: reencontra o alvo depois de classes geradas, reordenação e texto alterado", () => {
  page(`<aside><button aria-label="Criar projeto" class="sc-a1b2 Btn_root__x7f2a">Criar projeto</button></aside>
        <main><button>Cancelar</button></main>`);
  const target = dom.describeElement(document.querySelector("aside button")!);

  // deploy novo: classes trocadas, botão parecido adicionado antes, texto ganhou um ícone/emoji
  page(`<main><button>Criar relatório</button><button>Cancelar</button></main>
        <aside><button aria-label="Criar projeto" class="sc-zz99 Btn_root__k3j9q" id="new">＋ Criar projeto</button></aside>`);
  const found = dom.findTarget(target);
  assert.equal(found?.getAttribute("id"), "new");
});

test("data-luumu-id vence qualquer outro sinal", () => {
  page(`<button data-luumu-id="create">Novo</button><button aria-label="Criar">Criar</button>`);
  const t = dom.describeElement(document.querySelector("[data-luumu-id]")!);
  page(`<button aria-label="Criar">Novo</button><div><button data-luumu-id="create">Outro texto</button></div>`);
  assert.equal(dom.findTarget(t)?.textContent, "Outro texto");
});

test("alvo que não existe mais não casa com um elemento qualquer", () => {
  page(`<button>Excluir conta</button>`);
  const t = dom.describeElement(document.querySelector("button")!);
  page(`<button>Salvar</button><button>Voltar</button>`);
  assert.equal(dom.findTarget(t), null);
});

test("waitForElement espera o elemento aparecer e respeita o timeout", async () => {
  page(`<div id="root"></div>`);
  page(`<button id="late">Relatórios</button>`);
  const t = dom.describeElement(document.getElementById("late")!);
  page(`<div id="root"></div>`);
  setTimeout(() => {
    document.getElementById("root")!.innerHTML = `<button id="late">Relatórios</button>`;
  }, 80);
  const el = await dom.waitForElement(t, 2000);
  assert.equal(el?.id, "late");

  page(`<div></div>`);
  const started = Date.now();
  assert.equal(await dom.waitForElement(t, 300), null);
  assert.ok(Date.now() - started >= 280);
  await sleep(0);
});
