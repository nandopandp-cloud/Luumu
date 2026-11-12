/* eslint-disable @typescript-eslint/no-explicit-any -- elementos do Shadow DOM inspecionados nos testes */
/*
  Widget de acessibilidade (sdk/accessibility/widget.ts) num navegador simulado (happy-dom):
  launcher, painel, recursos aplicados à página, perfis, escolhas por estudante sincronizadas
  com a conta (qualquer aparelho), escopo de ativação, convite por grupo e por lista de
  convidados (sem a lista sair do servidor), desfecho do convite e limpeza total.
*/
import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { installDom, sleep } from "../tours/support/dom-env";
import { normalizeA11yConfig, publicA11yConfig, type PublicA11yConfig } from "@/lib/accessibility/config";

installDom("https://app.escola.com/inicio");
const g = globalThis as Record<string, unknown>;
type Widget = { boot(c: object): void; update(c: PublicA11yConfig): void; open(v?: string): void; close(): void; identify(): void; destroy(): void };
let w: Widget;
let fetches: { url: string; body: any }[] = [];
// "servidor" das rotas do plugin
let server: { match: boolean; profile: string | null; prefs: any; t: number } = { match: false, profile: null, prefs: null, t: 0 };
const calls = (path: string) => fetches.filter((f) => f.url.endsWith(`/accessibility/${path}`));
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
    const body = JSON.parse(init.body);
    fetches.push({ url, body });
    const reply = url.endsWith("/match")
      ? { match: server.match, profile: server.profile }
      : body.op === "get"
        ? server.prefs ? { prefs: server.prefs, t: server.t } : { prefs: null }
        : { ok: true, t: body.t };
    return new Response(JSON.stringify(reply), { status: 200 });
  };
  await import("@/sdk/accessibility/widget");
  w = (window as any).__luumuA11y;
});

beforeEach(() => {
  w.destroy();
  localStorage.clear();
  sessionStorage.clear();
  fetches = [];
  server = { match: false, profile: null, prefs: null, t: 0 };
  identity = {};
});

test("monta o launcher com os atalhos e abre o painel acessível", async () => {
  boot(cfg());
  const buttons = shadow().querySelectorAll(".launcher .lb");
  assert.equal(buttons.length, 3, "Acessibilidade + Libras + Navegação por rosto");
  // só o botão principal fica à vista: os atalhos ficam no grupo revelado por hover/foco
  assert.equal(shadow().querySelectorAll(".launcher .lb-more .lb").length, 2);
  assert.equal(shadow().querySelector(".launcher .lb-pill > .lb-main")?.getAttribute("data-a"), "open");
  const main = $('[data-a="open"]')!;
  assert.equal(main.getAttribute("aria-expanded"), "false");
  click(main);
  await sleep(5);
  assert.ok($(".panel")!.classList.contains("open"));
  assert.equal($(".panel")!.getAttribute("role"), "dialog");
  assert.equal($('[data-a="open"]')!.getAttribute("aria-expanded"), "true");
  assert.ok($('[data-k="pf:foco"]'), "perfis rápidos aparecem");
});

test("cores da cápsula de atalhos vêm do painel (botão principal segue a cor de destaque)", () => {
  boot(cfg({ brand: { accent: "#0F766E" }, launcher: { colors: { surface: "#FFFFFF", button: "#F1F2F8", icon: "#1F2340" } } }));
  const style = ($(".launcher") as HTMLElement).style;
  assert.equal(style.getPropertyValue("--lb-main"), "#0F766E", "sem cor própria, usa a de destaque");
  assert.equal(style.getPropertyValue("--lb-surface-solid"), "#FFFFFF");
  assert.equal(style.getPropertyValue("--lb-icon"), "#1F2340");
  assert.equal(style.getPropertyValue("--lb-main-ink"), "#FFFFFF", "ícone do botão principal com contraste");
  w.update(cfg({ brand: { accent: "#0F766E" }, launcher: { colors: { main: "#E11D48" } } }));
  assert.equal(($(".launcher") as HTMLElement).style.getPropertyValue("--lb-main"), "#E11D48");
});

test("ligar um recurso muda a página, avisa e fica guardado para o usuário", async () => {
  identity = { id: "aluno-1" };
  boot(cfg());
  click($('[data-a="open"]'));
  click($('[data-k="sw:highlightLinks"]'));
  assert.ok(html().classList.contains("lu-a11y-links"));
  assert.match($(".toast")!.textContent!, /Links destacados/);
  const saved = JSON.parse(localStorage.getItem("luumu_a11y_pk_test:aluno-1")!);
  assert.equal(saved.p.highlightLinks, true);
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
  assert.match($('.n-card[aria-pressed="true"]')!.textContent!, /Mais conforto na leitura/, "perfil sugerido já vem marcado");
  assert.equal(shadow().querySelectorAll(".n-card").length, 3, "até três perfis no convite");
  assert.match($(".n-text strong")!.textContent!, /mais confortável/, "trecho em negrito");
  assert.match(($(".n-art img") as HTMLImageElement).getAttribute("src")!, /^https:\/\/luumu\.test\/a11y\/convite-estudante\.png$/, "ilustração servida pela Luumu");
  assert.equal(calls("match").length, 0, "grupo decide no navegador, sem consultar a lista");
  click($('[data-n="accept"]'));
  assert.equal($(".mwrap"), null);
  assert.equal($(".panel")!.classList.contains("open"), false, "com perfil marcado, ativa direto");
  assert.ok(html().classList.contains("lu-a11y-font"), "fonte legível do perfil ligada");
  const memo = JSON.parse(localStorage.getItem("luumu_a11y_nudge_pk_test:aluno-9")!);
  assert.equal(memo.s, "accepted");
});

test("convite: marcar perfis nos cartões e ativar; sem nada marcado, abre o painel", async () => {
  identity = { id: "aluno-20" };
  boot(cfg({ nudge: { enabled: true, audience: "all", delay: 0 } }));
  await sleep(20);
  assert.equal(shadow().querySelectorAll('.n-card[aria-pressed="true"]').length, 0);
  click($('.n-card[data-id="foco"]'));
  click($('.n-card[data-id="ritmo"]'));
  click($('.n-card[data-id="ritmo"]')); // desmarca
  assert.equal($('.n-card[data-id="foco"]')!.getAttribute("aria-pressed"), "true");
  click($('[data-n="accept"]'));
  assert.equal(($(".mask-top") as HTMLElement).hidden, false, "Mais foco ligado");
  assert.equal(html().classList.contains("lu-a11y-cursor"), false, "ritmo desmarcado não liga");
  assert.match($(".toast")!.textContent!, /Mais foco: ativado/);

  w.destroy();
  localStorage.clear();
  sessionStorage.clear();
  identity = { id: "aluno-21" };
  boot(cfg({ nudge: { enabled: true, audience: "all", delay: 0, image: "none" } }));
  await sleep(20);
  assert.equal($(".n-art"), null, "sem ilustração");
  click($('[data-n="accept"]'));
  assert.ok($(".panel")!.classList.contains("open"), "nada marcado: abre o painel para escolher");
});

test("convite: fora do grupo e sem lista, nada aparece", async () => {
  identity = { id: "aluno-3", rede: "Outra rede" };
  boot(cfg({ nudge: { enabled: true, audience: "targeted", delay: 0, groups: [{ id: "g1", networks: ["Rede Aurora"] }] } }));
  await sleep(20);
  assert.equal($(".mwrap"), null);
});

test("convite pela lista de convidados: pergunta só pelo estudante logado, usa o perfil dele e registra o desfecho", async () => {
  identity = { id: "123", email: "ana@escola.br", user_hash: "a".repeat(64) };
  server.match = true;
  server.profile = "calma";
  boot(publicA11yConfig(normalizeA11yConfig({ nudge: { enabled: true, audience: "targeted", delay: 0, profile: "foco" } }), true));
  await sleep(30);
  // uma consulta (sem evento); a outra chamada é o registro de que ele viu o convite
  const match = calls("match").filter((c) => !c.body.event);
  assert.equal(match.length, 1);
  assert.deepEqual(match[0].body, { key: "pk_test", id: "123", email: "ana@escola.br", h: "a".repeat(64) });
  assert.ok($(".mwrap"), "convite exibido");
  assert.match($('.n-card[aria-pressed="true"]')!.textContent!, /Tela mais calma/, "perfil do convidado vence o do convite");
  click($('[data-n="dismiss"]'));
  await sleep(10);
  const events = calls("match").map((c) => c.body.event).filter(Boolean);
  assert.deepEqual(events, ["shown", "dismissed"], "o painel fica sabendo que ele viu e dispensou");
});

test("escopo por grupo: fora dele o plugin não aparece e a página fica intacta", async () => {
  identity = { id: "fora-1", rede: "Outra rede" };
  localStorage.setItem("luumu_a11y_pk_test:fora-1", JSON.stringify({ p: { highlightLinks: true }, t: 1 }));
  boot(cfg({ scope: { audience: "targeted", groups: [{ networks: ["Rede Aurora"] }], includeInvitees: false } }));
  await sleep(20);
  const host = document.querySelector('[data-luumu-ui="a11y"]') as HTMLElement;
  assert.equal(host.hidden, true);
  assert.equal(html().classList.contains("lu-a11y-links"), false, "escolhas guardadas não valem fora do escopo");
  w.destroy();
  identity = { id: "dentro-1", rede: "rede aurora" };
  boot(cfg({ scope: { audience: "targeted", groups: [{ networks: ["Rede Aurora"] }], includeInvitees: false } }));
  await sleep(20);
  assert.equal((document.querySelector('[data-luumu-ui="a11y"]') as HTMLElement).hidden, false);
});

test("escopo pela lista de convidados: o servidor confirma e o plugin aparece", async () => {
  identity = { id: "77" };
  server.match = true;
  boot(publicA11yConfig(normalizeA11yConfig({ scope: { audience: "targeted", includeInvitees: true } }), true));
  const host = document.querySelector('[data-luumu-ui="a11y"]') as HTMLElement;
  assert.equal(host.hidden, true, "escondido enquanto decide");
  await sleep(30);
  assert.equal(host.hidden, false);
  assert.equal(calls("match").length, 1);
});

test("preferências seguem o estudante entre aparelhos: a conta mais recente vence", async () => {
  // outro aparelho gravou depois: ao abrir aqui, vem da conta
  identity = { id: "aluno-5" };
  localStorage.setItem("luumu_a11y_pk_test:aluno-5", JSON.stringify({ p: { spacing: true }, t: 1000 }));
  server.prefs = { highlightLinks: true, textSize: 1 };
  server.t = 5000;
  boot(cfg());
  await sleep(30);
  assert.ok(html().classList.contains("lu-a11y-links"), "veio da conta");
  assert.equal(html().classList.contains("lu-a11y-spacing"), false);
  assert.equal(calls("prefs")[0].body.op, "get");
  assert.equal(JSON.parse(localStorage.getItem("luumu_a11y_pk_test:aluno-5")!).t, 5000, "cache local atualizado");

  // mudar aqui grava na conta (com atraso curto, juntando cliques seguidos)
  click($('[data-a="open"]'));
  click($('[data-k="sw:spacing"]'));
  click($('[data-k="sw:bigCursor"]'));
  await sleep(900);
  const sets = calls("prefs").filter((c) => c.body.op === "set");
  assert.equal(sets.length, 1);
  assert.equal(sets[0].body.prefs.spacing, true);
  assert.equal(sets[0].body.prefs.bigCursor, true);
  assert.equal(sets[0].body.id, "aluno-5");
});

test("preferências: escolhas feitas antes de entrar na conta sobem quando o servidor está mais velho", async () => {
  identity = { id: "aluno-6" };
  localStorage.setItem("luumu_a11y_pk_test:aluno-6", JSON.stringify({ p: { focusRing: true }, t: Date.now() }));
  boot(cfg());
  await sleep(30);
  const sets = calls("prefs").filter((c) => c.body.op === "set");
  assert.equal(sets.length, 1);
  assert.equal(sets[0].body.prefs.focusRing, true);
  // a leitura da conta acontece uma vez por sessão do navegador
  w.destroy();
  fetches = [];
  boot(cfg());
  await sleep(20);
  assert.equal(calls("prefs").filter((c) => c.body.op === "get").length, 0);
});

test("estudante não identificado: escolhas só no aparelho, nenhuma chamada ao servidor", async () => {
  boot(cfg());
  click($('[data-a="open"]'));
  click($('[data-k="sw:spacing"]'));
  await sleep(900);
  assert.equal(fetches.length, 0);
  assert.ok(localStorage.getItem("luumu_a11y_pk_test:anon"));
});

test("login sem recarregar a página (SPA): o identify faz o plugin e o convite aparecerem", async () => {
  server.match = true;
  // tela de login: ninguém identificado, plugin só para convidados
  boot(publicA11yConfig(normalizeA11yConfig({ scope: { audience: "targeted", includeInvitees: true }, nudge: { enabled: true, audience: "targeted", delay: 0 } }), true));
  await sleep(20);
  const host = document.querySelector('[data-luumu-ui="a11y"]') as HTMLElement;
  assert.equal(host.hidden, true, "na tela de login o plugin não aparece");
  assert.equal(calls("match").length, 0);

  // o produto faz o login e chama Luumu.identify, sem recarregar
  identity = { id: "convidado-1" };
  w.identify();
  await sleep(40);
  assert.equal(host.hidden, false, "o plugin aparece para o convidado");
  assert.ok($(".mwrap"), "e o convite também");

  // logout (Luumu.reset): tudo sai da tela
  identity = {};
  w.identify();
  await sleep(20);
  assert.equal(host.hidden, true);
  assert.equal($(".mwrap"), null);
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
