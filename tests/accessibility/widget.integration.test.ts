/* eslint-disable @typescript-eslint/no-explicit-any -- elementos do Shadow DOM inspecionados nos testes */
/*
  Widget de acessibilidade (sdk/accessibility/widget.ts) num navegador simulado (happy-dom):
  launcher, painel, recursos aplicados à página, perfis, escolhas guardadas por usuário,
  convite por grupo e por lista individual (sem a lista sair do servidor) e limpeza total.
*/
import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { installDom, sleep } from "../tours/support/dom-env";
import { normalizeA11yConfig, publicA11yConfig, type PublicA11yConfig } from "@/lib/accessibility/config";

installDom("https://app.escola.com/inicio");
const g = globalThis as Record<string, unknown>;
type Widget = { boot(c: object): void; update(c: PublicA11yConfig): void; open(v?: string): void; close(): void; destroy(): void };
let w: Widget;
let fetches: { url: string; body: any }[] = [];
let matchReply = false;
let identity: Record<string, unknown> = {};

const cfg = (over: object = {}) => publicA11yConfig(normalizeA11yConfig(over));
const shadow = () => (document.querySelector('[data-luumu-ui="a11y"]') as any)?.shadowRoot as ShadowRoot;
const $ = (sel: string) => shadow().querySelector(sel) as HTMLElement | null;
const click = (el: Element | null) => {
  assert.ok(el, "elemento não encontrado");
  el!.dispatchEvent(new (window as any).MouseEvent("click", { bubbles: true, composed: true }));
};
const html = () => document.documentElement;

function boot(config: PublicA11yConfig, extra: object = {}) {
  w.boot({ api: "https://luumu.test/api/v1", key: "pk_test", host: "app.escola.com", config, identity: () => identity, ...extra });
}

before(async () => {
  document.body.innerHTML = `<main><h1>Revolução Industrial</h1><p id="p1">As máquinas a vapor mudaram o trabalho.</p><a href="/x">Exercícios</a></main>`;
  g.fetch = async (url: string, init: { body: string }) => {
    fetches.push({ url, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ match: matchReply }), { status: 200 });
  };
  await import("@/sdk/accessibility/widget");
  w = (window as any).__luumuA11y;
});

beforeEach(() => {
  w.destroy();
  localStorage.clear();
  sessionStorage.clear();
  fetches = [];
  matchReply = false;
  identity = {};
});

test("monta o launcher com os atalhos e abre o painel acessível", async () => {
  boot(cfg());
  const buttons = shadow().querySelectorAll(".launcher .lb");
  assert.equal(buttons.length, 3, "Acessibilidade + Libras + Navegação por rosto");
  const main = $('[data-a="open"]')!;
  assert.equal(main.getAttribute("aria-expanded"), "false");
  click(main);
  await sleep(5);
  assert.ok($(".panel")!.classList.contains("open"));
  assert.equal($(".panel")!.getAttribute("role"), "dialog");
  assert.equal($('[data-a="open"]')!.getAttribute("aria-expanded"), "true");
  assert.ok($('[data-k="pf:foco"]'), "perfis rápidos aparecem");
});

test("ligar um recurso muda a página, avisa e fica guardado para o usuário", async () => {
  identity = { id: "aluno-1" };
  boot(cfg());
  click($('[data-a="open"]'));
  click($('[data-k="sw:highlightLinks"]'));
  assert.ok(html().classList.contains("lu-a11y-links"));
  assert.match($(".toast")!.textContent!, /Links destacados/);
  const saved = JSON.parse(localStorage.getItem("luumu_a11y_pk_test:aluno-1")!);
  assert.equal(saved.highlightLinks, true);
  // o selo do launcher conta o ajuste
  assert.equal($(".lb-badge")!.textContent, "1");

  // outra sessão do mesmo usuário recupera; outro usuário começa do zero
  w.destroy();
  assert.equal(html().classList.contains("lu-a11y-links"), false, "destroy devolve a página como era");
  boot(cfg());
  assert.ok(html().classList.contains("lu-a11y-links"));
  w.destroy();
  identity = { id: "aluno-2" };
  boot(cfg());
  assert.equal(html().classList.contains("lu-a11y-links"), false);
});

test("perfil rápido liga vários recursos (máscara visível, animações pausadas)", () => {
  boot(cfg());
  click($('[data-a="open"]'));
  click($('[data-k="pf:foco"]'));
  assert.equal($('[data-k="pf:foco"]')!.getAttribute("aria-pressed"), "true");
  assert.equal(($(".mask-top") as HTMLElement).hidden, false);
  assert.equal(($(".guide") as HTMLElement).hidden, false);
  assert.ok(html().classList.contains("lu-a11y-still"));
  click($('[data-k="reset"]'));
  assert.equal(($(".mask-top") as HTMLElement).hidden, true);
  assert.equal(html().classList.contains("lu-a11y-still"), false);
});

test("tamanho do texto escala os elementos com texto e volta ao restaurar", () => {
  boot(cfg());
  click($('[data-a="open"]'));
  const p = document.getElementById("p1")!;
  const before = parseFloat(getComputedStyle(p).fontSize) || 16;
  click($('[data-k="size+"]'));
  click($('[data-k="size+"]'));
  assert.equal(p.style.getPropertyValue("font-size"), `${Math.round(before * 1.3 * 10) / 10}px`);
  assert.match($(".pct")!.textContent!, /130%/);
  click($('[data-k="reset"]'));
  assert.equal(p.style.getPropertyValue("font-size"), "");
});

test("contraste e daltonismo viram filtro no <html>", () => {
  boot(cfg());
  click($('[data-a="open"]'));
  click($('[data-k="contrast:high"]'));
  click($('[data-k="colorBlind:deutan"]'));
  const f = html().style.getPropertyValue("filter");
  assert.match(f, /contrast\(1\.35\)/);
  assert.match(f, /url\(#lu-a11y-cb-deutan\)/);
  assert.ok(document.getElementById("lu-a11y-cb-deutan"), "filtro SVG inserido na página");
});

test("recurso desligado no painel da Luumu não aparece para o estudante", () => {
  const c = normalizeA11yConfig({});
  c.features.libras = false;
  c.features.textReader = false;
  boot(publicA11yConfig(c));
  assert.equal(shadow().querySelectorAll(".launcher .lb").length, 2, "sem atalho de Libras");
  click($('[data-a="open"]'));
  assert.equal($('[data-k="sw:textReader"]'), null);
  assert.equal($('[data-k="pf:libras"]'), null, "perfil sem recurso disponível some");
});

test("Libras com o VLibras já instalado no site: reaproveita o tradutor e acompanha o fechamento", async () => {
  // o site do cliente já carrega o VLibras: botão dele + window.VLibrasWidget.open()
  const wrapper = document.createElement("div");
  wrapper.id = "vlibras-access-wrapper";
  document.body.appendChild(wrapper);
  let opened = 0;
  (window as any).VLibras = { Widget: function () {} };
  (window as any).VLibrasWidget = {
    open() {
      opened++;
      let root = document.getElementById("vlibras-app-root");
      if (!root) {
        root = document.createElement("div");
        root.id = "vlibras-app-root";
        document.body.appendChild(root);
      }
      root.setAttribute("data-active", "true");
    },
  };
  try {
    boot(cfg());
    click($('[data-a="libras"]'));
    await sleep(30);
    assert.equal(opened, 1, "abre o tradutor do próprio site");
    assert.equal(document.querySelectorAll("script[data-luumu-ui='a11y-vlibras']").length, 0, "não carrega o VLibras de novo");
    assert.equal($('[data-a="libras"]')!.getAttribute("aria-pressed"), "true");

    // o estudante fecha pelo X do VLibras: o botão da Luumu desliga junto
    await sleep(150);
    document.getElementById("vlibras-app-root")!.setAttribute("data-active", "false");
    await sleep(20);
    assert.equal($('[data-a="libras"]')!.getAttribute("aria-pressed"), "false");

    // e pelo botão da Luumu: liga e desliga o tradutor
    click($('[data-a="libras"]'));
    await sleep(30);
    assert.equal(document.getElementById("vlibras-app-root")!.getAttribute("data-active"), "true");
    click($('[data-a="libras"]'));
    assert.equal(document.getElementById("vlibras-app-root")!.getAttribute("data-active"), "false");
  } finally {
    wrapper.remove();
    document.getElementById("vlibras-app-root")?.remove();
    delete (window as any).VLibras;
    delete (window as any).VLibrasWidget;
  }
});

test("Libras sem VLibras no site: carrega o oficial com avatar, lado e personalização aprovada", async () => {
  (window as any).happyDOM.settings.disableJavaScriptFileLoading = true;
  try {
    boot(cfg({ launcher: { position: "bottom-right" }, libras: { avatar: "hosana", personalizationUrl: "https://vlibras.gov.br/config/aurora.json" } }));
    click($('[data-a="libras"]'));
    const script = document.querySelector("script[data-luumu-ui='a11y-vlibras']") as HTMLScriptElement;
    assert.ok(script, "script do VLibras inserido");
    assert.equal(script.getAttribute("src"), "https://vlibras.gov.br/app/vlibras-plugin.js");
    const vw = (window as any).VLibrasWidget;
    assert.equal(vw.avatar, "hosana");
    assert.equal(vw.position, "L", "abre do lado oposto aos botões da Luumu");
    assert.equal(vw.personalization, "https://vlibras.gov.br/config/aurora.json");
    // sem rede/CSP bloqueando: avisa e desliga o recurso
    script.dispatchEvent(new (window as any).Event("error"));
    await sleep(30);
    assert.equal($('[data-a="libras"]')!.getAttribute("aria-pressed"), "false");
    assert.match($(".toast")!.textContent!, /tradutor de Libras/);
  } finally {
    document.querySelectorAll("script[data-luumu-ui='a11y-vlibras']").forEach((s) => s.remove());
    delete (window as any).VLibrasWidget;
    (window as any).happyDOM.settings.disableJavaScriptFileLoading = false;
  }
});

test("convite por grupo: estudante da turma vê, aceita e o perfil sugerido liga", async () => {
  identity = { id: "aluno-9", rede: "Rede Aurora", turma: "1ª série B" };
  boot(cfg({ nudge: { enabled: true, audience: "targeted", delay: 0, profile: "leitura", groups: [{ id: "g1", networks: ["rede aurora"], classes: ["1ª Série B"] }] } }));
  await sleep(20);
  assert.ok($(".mwrap"), "convite exibido");
  assert.match($(".sugg")!.textContent!, /Mais conforto na leitura/);
  assert.equal(fetches.length, 0, "grupo decide no navegador, sem consultar a lista");
  click($('[data-n="accept"]'));
  assert.equal($(".mwrap"), null);
  assert.ok($(".panel")!.classList.contains("open"), "painel abre depois de aceitar");
  assert.ok(html().classList.contains("lu-a11y-font"), "fonte legível do perfil ligada");
  const memo = JSON.parse(localStorage.getItem("luumu_a11y_nudge_pk_test:aluno-9")!);
  assert.equal(memo.s, "accepted");
});

test("convite: fora do grupo e sem lista, nada aparece", async () => {
  identity = { id: "aluno-3", rede: "Outra rede" };
  boot(cfg({ nudge: { enabled: true, audience: "targeted", delay: 0, groups: [{ id: "g1", networks: ["Rede Aurora"] }] } }));
  await sleep(20);
  assert.equal($(".mwrap"), null);
});

test("convite pela lista individual: pergunta ao servidor só pelo estudante logado", async () => {
  identity = { id: "123", email: "ana@escola.br" };
  matchReply = true;
  const config = cfg({ nudge: { enabled: true, audience: "targeted", delay: 0, students: ["ana@escola.br", "bia@escola.br"] } });
  assert.equal(JSON.stringify(config).includes("bia@escola.br"), false, "a lista não está na config pública");
  boot(config);
  await sleep(30);
  assert.equal(fetches.length, 1);
  assert.equal(fetches[0].url, "https://luumu.test/api/v1/accessibility/match");
  assert.deepEqual(fetches[0].body, { key: "pk_test", id: "123", email: "ana@escola.br" });
  assert.ok($(".mwrap"), "convite exibido");
  click($('[data-n="dismiss"]'));
  assert.equal($(".mwrap"), null);
  assert.equal(JSON.parse(localStorage.getItem("luumu_a11y_nudge_pk_test:123")!).s, "dismissed");
});

test("prévia não grava nada no navegador", () => {
  boot(cfg(), { preview: {} });
  click($('[data-a="open"]'));
  click($('[data-k="sw:highlightLinks"]'));
  assert.equal(localStorage.length, 0);
  w.destroy();
  boot(cfg(), { preview: {} });
  assert.equal(html().classList.contains("lu-a11y-links"), false, "recomeçar zera a prévia");
});

test("update troca a cor e os textos sem perder o estado", () => {
  boot(cfg());
  click($('[data-a="open"]'));
  click($('[data-k="sw:spacing"]'));
  w.update(cfg({ brand: { title: "Recursos", accent: "#0F766E" } }));
  assert.equal($(".p-title")!.textContent, "Recursos");
  assert.equal(($(".root") as HTMLElement).style.getPropertyValue("--acc"), "#0F766E");
  assert.ok(html().classList.contains("lu-a11y-spacing"));
});
