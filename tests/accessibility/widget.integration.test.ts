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
let server: { match: boolean; profile: string | null; status?: string | null; prefs: any; t: number; nudge?: any } = { match: false, profile: null, prefs: null, t: 0 };
// contas por estudante; `server.prefs/t` pré-carregados valem para o primeiro estudante identificado do teste
let accounts: Record<string, { prefs: any; t: number; nudge?: any }> = {};
let seededFor: string | null = null;
let clock = 10_000; // "hora do servidor" dos testes
let failNextGets = 0;
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
    // o "servidor" guarda o que recebe (hora do servidor: a última gravação vale), por ID e por e-mail
    if (failNextGets > 0 && url.endsWith("/prefs") && body.op === "get") {
      failNextGets--;
      return new Response("{}", { status: 503 });
    }
    const keys = [body.id, body.email].filter((k) => k !== null && k !== undefined && k !== "").map((k: unknown) => String(k).toLowerCase());
    if (seededFor && keys.includes(seededFor) && !accounts[seededFor]) accounts[seededFor] = { prefs: server.prefs, t: server.t, nudge: server.nudge };
    if (url.endsWith("/prefs") && body.op === "set") {
      clock++;
      for (const k of keys) {
        const prev = accounts[k];
        accounts[k] = { prefs: body.prefs, t: clock, nudge: body.nudge ?? prev?.nudge };
      }
      server.prefs = body.prefs;
      server.t = clock;
      if (body.nudge) server.nudge = body.nudge;
    }
    const found = keys.map((k) => accounts[k]).filter(Boolean).sort((x, y) => y.t - x.t)[0];
    const reply = url.endsWith("/match")
      ? { match: server.match, profile: server.profile, status: server.status ?? null }
      : body.op === "get"
        ? found && (found.prefs || found.nudge) ? { prefs: found.prefs ?? null, t: found.t, nudge: found.nudge ?? null } : { prefs: null, nudge: null }
        : { ok: true, t: clock };
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
  accounts = {};
  seededFor = null;
  failNextGets = 0;
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
  // perfis de acessibilidade no topo, depois as seções do layout de referência
  const secs = [...shadow().querySelectorAll(".sec-t")].map((h) => h.textContent!.trim());
  assert.deepEqual(secs, ["Perfis de acessibilidade", "Navegação e interação", "Leitura", "Cores e contraste", "Comunicação"]);
  const perfis = [...shadow().querySelectorAll(".prof b")].map((b) => b.textContent);
  assert.deepEqual(perfis, ["Usuário cego (leitor de tela)", "Baixa visão", "Habilidades motoras", "Daltonismo", "Epilepsia", "TDAH", "Dislexia", "Deficiência auditiva"]);
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

test("perfil do painel liga vários recursos de uma vez (TDAH: máscara, guia e sem animações)", () => {
  boot(cfg());
  click($('[data-a="open"]'));
  click($('[data-k="pf:foco"]'));
  assert.equal($('[data-k="pf:foco"]')!.getAttribute("aria-pressed"), "true");
  assert.equal(($(".mask-top") as HTMLElement).hidden, false);
  assert.equal(($(".guide") as HTMLElement).hidden, false);
  assert.ok(html().classList.contains("lu-a11y-still"));
  assert.match($(".toast")!.textContent!, /TDAH: ativado/);
  click($('[data-k="pf:foco"]'));
  assert.equal(($(".mask-top") as HTMLElement).hidden, true);
});

test("máscara e pausar animações pelas chaves do painel; restaurar desliga tudo", () => {
  boot(cfg());
  click($('[data-a="open"]'));
  click($('[data-k="sw:readingMask"]'));
  click($('[data-k="sw:stopAnimations"]'));
  assert.equal(($(".mask-top") as HTMLElement).hidden, false);
  assert.ok(html().classList.contains("lu-a11y-still"));
  assert.ok($('[data-row="readingMask"]')!.classList.contains("on"));
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
  assert.match($('[data-row="textSize"], .row:has([data-k="size+"])')!.textContent!, /130%/);
  click($('[data-k="reset"]'));
  assert.equal(p.style.getPropertyValue("font-size"), "");
});

test("contraste e daltonismo viram filtro no <html>", () => {
  boot(cfg());
  click($('[data-a="open"]'));
  // a chave liga a variação mais comum; as outras aparecem logo abaixo
  assert.equal($('[data-k="contrast:dark"]'), null, "variações só aparecem com a chave ligada");
  click($('[data-k="sw:contrast"]'));
  click($('[data-k="sw:colorBlind"]'));
  click($('[data-k="colorBlind:protan"]'));
  const f = html().style.getPropertyValue("filter");
  assert.match(f, /contrast\(1\.35\)/);
  assert.match(f, /url\(#lu-a11y-cb-protan\)/);
  assert.ok(document.getElementById("lu-a11y-cb-protan"), "filtro SVG inserido na página");
  click($('[data-k="sw:contrast"]'));
  assert.doesNotMatch(html().style.getPropertyValue("filter"), /contrast/, "desligar a chave volta ao normal");
});

test("recurso desligado no painel da Luumu não aparece para o estudante", () => {
  const c = normalizeA11yConfig({});
  c.features.libras = false;
  c.features.textReader = false;
  boot(publicA11yConfig(c));
  assert.equal(shadow().querySelectorAll(".launcher .lb").length, 2, "sem atalho de Libras");
  click($('[data-a="open"]'));
  assert.equal($('[data-k="sw:textReader"]'), null);
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

test("Libras com o intérprete Luumu (beta): abre o intérprete 3D, não o VLibras, com o visual do painel", async () => {
  const created: any[] = [];
  const updates: any[] = [];
  let destroyed = 0;
  (window as any).__luumuLibras3d = {
    create(o: any) {
      created.push(o);
      return { update: (...a: any[]) => updates.push(a), translate: async () => {}, destroy: () => destroyed++ };
    },
  };
  try {
    const look = { interpreter: "jf2", shirtColor: "#5B2BD9", logo: "custom", logoUrl: "https://cdn.escola.com/logo.png", background: "menta" };
    boot(cfg({ launcher: { position: "bottom-right" }, libras: { engine: "luumu", look } }));
    click($('[data-a="libras"]'));
    await sleep(10);
    assert.equal(created.length, 1, "intérprete Luumu criado");
    assert.equal(document.querySelector("script[data-luumu-ui='a11y-vlibras']"), null, "o VLibras não é carregado");
    const o = created[0];
    assert.equal(o.look.interpreter, "jf2");
    assert.equal(o.logoUrl, "https://cdn.escola.com/logo.png");
    assert.equal(o.side, "left", "janela no lado oposto aos botões da Luumu");
    assert.equal(o.api, "https://luumu.test/api/v1");
    assert.equal(o.origin, "https://luumu.test");
    assert.equal($('[data-a="libras"]')!.getAttribute("aria-pressed"), "true");
    // painel muda o visual: a janela aberta acompanha
    w.update(cfg({ launcher: { position: "bottom-right" }, libras: { engine: "luumu", look: { ...look, interpreter: "jm2", logo: "none" } } }));
    assert.equal(updates.at(-1)[0].interpreter, "jm2");
    assert.equal(updates.at(-1)[1], "", "sem logo");
    // o estudante fecha pela própria janela: o recurso desliga
    o.onClose();
    await sleep(10);
    assert.equal(destroyed, 1);
    assert.equal($('[data-a="libras"]')!.getAttribute("aria-pressed"), "false");
    // sem WebGL: avisa e desliga
    (window as any).__luumuLibras3d = { create() { throw new Error("webgl"); } };
    click($('[data-a="libras"]'));
    await sleep(10);
    assert.equal($('[data-a="libras"]')!.getAttribute("aria-pressed"), "false");
    assert.match($(".toast")!.textContent!, /tradutor de Libras/);
  } finally {
    delete (window as any).__luumuLibras3d;
  }
});

test("trocar de VLibras para o intérprete Luumu no painel com Libras aberto troca a janela", async () => {
  (window as any).happyDOM.settings.disableJavaScriptFileLoading = true;
  const created: any[] = [];
  (window as any).__luumuLibras3d = { create(o: any) { created.push(o); return { update() {}, translate: async () => {}, destroy() {} }; } };
  try {
    boot(cfg());
    click($('[data-a="libras"]'));
    assert.ok(document.querySelector("script[data-luumu-ui='a11y-vlibras']"), "começa com o VLibras");
    w.update(cfg({ libras: { engine: "luumu" } }));
    await sleep(10);
    assert.equal(created.length, 1, "abre o intérprete Luumu no lugar");
  } finally {
    document.querySelectorAll("script[data-luumu-ui='a11y-vlibras']").forEach((s) => s.remove());
    delete (window as any).VLibrasWidget;
    delete (window as any).__luumuLibras3d;
    (window as any).happyDOM.settings.disableJavaScriptFileLoading = false;
  }
});

test("convite por grupo: estudante da turma vê, aceita e o perfil sugerido liga", async () => {
  identity = { id: "aluno-9", rede: "Rede Aurora", turma: "1ª série B" };
  boot(cfg({ nudge: { enabled: true, audience: "targeted", delay: 0, profile: "leitura", groups: [{ id: "g1", networks: ["rede aurora"], classes: ["1ª Série B"] }] } }));
  await sleep(20);
  assert.ok($(".mwrap"), "convite exibido");
  assert.match($(".n-card")!.textContent!, /Mais conforto na leitura/, "perfil sugerido aparece primeiro");
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

test("convite: perfis já vêm marcados e sem clique; aceitar liga todos", async () => {
  identity = { id: "aluno-20" };
  boot(cfg({ nudge: { enabled: true, audience: "all", delay: 0 } }));
  await sleep(20);
  const cards = [...shadow().querySelectorAll(".n-card")];
  assert.equal(cards.length, 3);
  assert.ok(cards.every((c) => c.classList.contains("on")), "todos marcados");
  assert.ok(cards.every((c) => c.tagName === "LI" && !c.hasAttribute("data-n")), "não são botões");
  click(cards[0]); // clicar no cartão não desmarca
  assert.ok(cards[0].classList.contains("on"));
  click($('[data-n="accept"]'));
  assert.equal(($(".mask-top") as HTMLElement).hidden, false, "Mais foco ligado");
  assert.ok(html().classList.contains("lu-a11y-font"), "Mais conforto na leitura ligado");
  assert.ok(html().classList.contains("lu-a11y-cursor"), "Uma navegação no seu ritmo ligado");
  assert.match($(".toast")!.textContent!, /3 perfis: ativados/);

  // sem perfis disponíveis: não há cartões e o botão principal abre o painel
  w.destroy();
  localStorage.clear();
  sessionStorage.clear();
  identity = { id: "aluno-21" };
  boot(cfg({ profiles: [], nudge: { enabled: true, audience: "all", delay: 0, image: "none" } }));
  await sleep(20);
  assert.equal($(".n-art"), null, "sem ilustração");
  assert.equal($(".n-card"), null);
  click($('[data-n="accept"]'));
  assert.ok($(".panel")!.classList.contains("open"), "abre o painel para escolher");
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
  assert.match($(".n-card")!.textContent!, /Tela mais calma/, "perfil do convidado vence o do convite");
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
  seededFor = "aluno-5";
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
  // a conta é relida no máximo uma vez por minuto (a cada página, não a cada render)
  w.destroy();
  fetches = [];
  boot(cfg());
  await sleep(20);
  assert.equal(calls("prefs").filter((c) => c.body.op === "get").length, 0);
});

test("relógio do aparelho não decide: sem mudança pendente, o aparelho adota a conta", async () => {
  // aparelho com relógio adiantado e escolhas antigas já sincronizadas
  identity = { id: "aluno-40" };
  localStorage.setItem("luumu_a11y_pk_test:aluno-40", JSON.stringify({ p: { spacing: true }, t: Date.now() + 36e6, d: false }));
  accounts["aluno-40"] = { prefs: { highlightLinks: true }, t: 20_000 };
  boot(cfg());
  await sleep(40);
  assert.ok(html().classList.contains("lu-a11y-links"), "a última necessidade da conta vale");
  assert.equal(html().classList.contains("lu-a11y-spacing"), false);
  assert.equal(calls("prefs").filter((c) => c.body.op === "set").length, 0, "não sobrescreve a conta com dado velho");
});

test("mudança feita aqui e ainda não confirmada vence a conta (ex.: estava sem internet)", async () => {
  identity = { id: "aluno-41" };
  localStorage.setItem("luumu_a11y_pk_test:aluno-41", JSON.stringify({ p: { bigCursor: true }, t: 1, d: true }));
  accounts["aluno-41"] = { prefs: { highlightLinks: true }, t: 20_000 };
  boot(cfg());
  await sleep(40);
  assert.ok(html().classList.contains("lu-a11y-cursor"));
  assert.equal(accounts["aluno-41"].prefs.bigCursor, true, "enviada para a conta");
  assert.equal(JSON.parse(localStorage.getItem("luumu_a11y_pk_test:aluno-41")!).d, false, "pendência resolvida");
});

test("aparelho que identifica só com o e-mail encontra as escolhas salvas com ID e e-mail", async () => {
  identity = { id: "77", email: "Ana@Escola.br" };
  boot(cfg());
  await sleep(20);
  click($('[data-a="open"]'));
  click($('[data-k="sw:highlightHeadings"]'));
  await sleep(900);
  w.destroy();
  localStorage.clear();
  sessionStorage.clear();
  identity = { email: "ana@escola.br" }; // outro aparelho: o produto só manda o e-mail
  boot(cfg());
  await sleep(40);
  assert.ok(html().classList.contains("lu-a11y-headings"));
});

test("leitura da conta que falha tenta de novo e aplica as escolhas", async () => {
  identity = { id: "aluno-42" };
  accounts["aluno-42"] = { prefs: { stopAnimations: true }, t: 20_000 };
  failNextGets = 1;
  boot(cfg());
  await sleep(60);
  assert.equal(html().classList.contains("lu-a11y-still"), false, "primeira leitura falhou");
  await sleep(3200);
  assert.ok(html().classList.contains("lu-a11y-still"), "segunda tentativa aplicou");
});

test("desligar tudo (ou Restaurar padrão) também vale nos outros aparelhos", async () => {
  // aparelho A: tinha recursos ligados e desliga tudo
  identity = { id: "aluno-50" };
  boot(cfg());
  await sleep(20);
  click($('[data-a="open"]'));
  click($('[data-k="sw:highlightLinks"]'));
  click($('[data-k="sw:spacing"]'));
  await sleep(900);
  assert.equal(accounts["aluno-50"].prefs.spacing, true);

  // aparelho B (outro navegador) abre com os recursos ligados
  w.destroy();
  localStorage.clear();
  sessionStorage.clear();
  boot(cfg());
  await sleep(40);
  assert.ok(html().classList.contains("lu-a11y-spacing"));

  // ...e de volta ao A, o estudante restaura o padrão
  click($('[data-a="open"]'));
  click($('[data-k="reset"]'));
  await sleep(900);
  assert.equal(accounts["aluno-50"].prefs.spacing, false, "a conta guarda o 'tudo desligado'");

  // aparelho C / janela anônima: abre sem nenhum recurso
  w.destroy();
  localStorage.clear();
  sessionStorage.clear();
  boot(cfg());
  await sleep(40);
  assert.equal(html().classList.contains("lu-a11y-spacing"), false);
  assert.equal(html().classList.contains("lu-a11y-links"), false);

  // aparelho B de novo, com o cache antigo (recursos ligados) ainda no navegador: adota a conta
  w.destroy();
  localStorage.clear();
  localStorage.setItem("luumu_a11y_pk_test:aluno-50", JSON.stringify({ p: { spacing: true, highlightLinks: true }, t: Date.now(), d: false }));
  boot(cfg());
  await sleep(40);
  assert.equal(html().classList.contains("lu-a11y-spacing"), false, "o cache antigo não vence a conta");
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

test("convite aceito vale na conta: limpar o navegador ou trocar de aparelho não pede de novo", async () => {
  identity = { id: "aluno-30" };
  boot(cfg({ nudge: { enabled: true, audience: "all", delay: 0, profile: "leitura" } }));
  await sleep(30);
  assert.ok($(".mwrap"), "primeiro acesso: convite aparece");
  click($('[data-n="accept"]'));
  assert.ok(html().classList.contains("lu-a11y-font"), "perfil sugerido ligado");
  await sleep(900);
  assert.equal(server.nudge?.s, "accepted", "o aceite foi para a conta");
  assert.equal(server.prefs?.legibleFont, true, "as escolhas também");

  // outro aparelho / navegador limpo / janela anônima: nada guardado localmente
  w.destroy();
  localStorage.clear();
  sessionStorage.clear();
  boot(cfg({ nudge: { enabled: true, audience: "all", delay: 0, profile: "leitura" } }));
  await sleep(40);
  assert.ok(html().classList.contains("lu-a11y-font"), "a plataforma já abre com as necessidades confirmadas");
  assert.equal($(".mwrap"), null, "o convite não reaparece");
});

test("mudanças depois de aceitar o convite também ficam na conta", async () => {
  identity = { id: "aluno-31" };
  boot(cfg({ nudge: { enabled: true, audience: "all", delay: 0, profile: "foco" } }));
  await sleep(30);
  click($('[data-n="accept"]'));
  // depois troca: desliga a máscara do perfil e liga destacar títulos
  click($('[data-a="open"]'));
  click($('[data-k="sw:readingMask"]'));
  click($('[data-k="sw:highlightHeadings"]'));
  await sleep(900);
  assert.equal(server.prefs.readingMask, false);
  assert.equal(server.prefs.highlightHeadings, true);
  assert.equal(server.nudge.s, "accepted");

  w.destroy();
  localStorage.clear();
  sessionStorage.clear();
  boot(cfg({ nudge: { enabled: true, audience: "all", delay: 0, profile: "foco" } }));
  await sleep(40);
  assert.ok(html().classList.contains("lu-a11y-headings"), "a escolha mais nova vale no aparelho novo");
  assert.equal(($(".mask-top") as HTMLElement).hidden, true, "o que ele desligou continua desligado");
  assert.equal($(".mwrap"), null);
});

test("fechar a aba logo depois de mudar não perde a mudança", async () => {
  identity = { id: "aluno-32" };
  boot(cfg());
  await sleep(20);
  click($('[data-a="open"]'));
  click($('[data-k="sw:spacing"]'));
  window.dispatchEvent(new (window as any).Event("pagehide"));
  await sleep(10);
  assert.equal(server.prefs?.spacing, true, "enviado na hora, sem esperar o intervalo");
});

test("convidado que já aceitou (registrado no painel) não vê o convite num navegador novo", async () => {
  identity = { id: "convidado-9" };
  server.match = true;
  server.status = "accepted";
  boot(publicA11yConfig(normalizeA11yConfig({ nudge: { enabled: true, audience: "targeted", delay: 0 } }), true));
  await sleep(40);
  assert.equal($(".mwrap"), null);
});

test("prévia do painel: editar o texto do convite não rouba o foco nem registra 'visto' de novo", async () => {
  // o campo do painel da Luumu ao lado da prévia
  const field = document.createElement("textarea");
  document.body.appendChild(field);
  try {
    boot(cfg({ nudge: { enabled: true } }), { preview: {} });
    w.open("nudge");
    await sleep(60);
    field.focus();
    assert.equal(document.activeElement, field);
    for (const msg of ["Texto 1", "Texto 12", "Texto 1"]) {
      w.update(cfg({ nudge: { enabled: true, message: msg } }));
      await sleep(50);
      assert.equal(document.activeElement, field, "o foco continua no campo enquanto digita");
    }
    assert.equal($(".n-text")!.textContent, "Texto 1", "a prévia mostra o texto novo");
  } finally {
    field.remove();
  }
});

test("produto: atualizar a configuração com o convite aberto não registra 'visto' de novo", async () => {
  identity = { id: "convidado-redraw" };
  server.match = true;
  boot(publicA11yConfig(normalizeA11yConfig({ nudge: { enabled: true, audience: "targeted", delay: 0 } }), true));
  await sleep(40);
  assert.ok($(".mwrap"));
  w.update(publicA11yConfig(normalizeA11yConfig({ nudge: { enabled: true, audience: "targeted", delay: 0, title: "Novo" } }), true));
  await sleep(20);
  assert.equal($(".n-title")!.textContent, "Novo");
  const shown = calls("match").filter((c) => c.body.event === "shown");
  assert.equal(shown.length, 1);
});

test("botão arrastável: soltar em outro lugar salva a posição e não abre o painel", async () => {
  boot(cfg());
  const main = $(".lb-main")!;
  const ev = (type: string, x: number, y: number) =>
    main.dispatchEvent(new (window as any).PointerEvent(type, { bubbles: true, composed: true, pointerId: 7, button: 0, clientX: x, clientY: y }));
  // centro do botão no navegador simulado: (160, 118)
  ev("pointerdown", 160, 118);
  ev("pointermove", 260, 200);
  ev("pointermove", 400, 300);
  assert.ok($(".launcher")!.classList.contains("dragging"));
  ev("pointerup", 400, 300);
  click(main);
  assert.equal($(".panel")!.classList.contains("open"), false, "soltar não abre o painel");
  const saved = JSON.parse(localStorage.getItem("luumu_a11y_pk_test:anon")!).p.launcherPos;
  assert.deepEqual(saved, { x: 400 / 1280, y: 300 / 800 });
  const l = $(".launcher") as HTMLElement;
  assert.equal(l.style.left, "366px");
  assert.equal(l.style.top, "266px", "na metade de cima: atalhos abrem para baixo");
  assert.ok(l.classList.contains("mid") && l.classList.contains("left"), "dicas à direita perto da borda esquerda");

  // um toque sem arrastar continua abrindo o painel
  ev("pointerdown", 400, 300);
  ev("pointermove", 402, 301);
  ev("pointerup", 402, 301);
  await sleep(400);
  click($(".lb-main"));
  assert.ok($(".panel")!.classList.contains("open"));

  // restaurar padrão volta para o canto configurado
  click($('[data-k="reset"]'));
  assert.equal(($(".launcher") as HTMLElement).style.bottom, "24px");
});

test("botão arrastável: Shift + setas movem; opção desligada no painel impede arrastar", () => {
  boot(cfg());
  const main = $(".lb-main")!;
  main.dispatchEvent(new (window as any).KeyboardEvent("keydown", { key: "ArrowLeft", shiftKey: true, bubbles: true, composed: true }));
  const pos = JSON.parse(localStorage.getItem("luumu_a11y_pk_test:anon")!).p.launcherPos;
  assert.ok(pos && pos.x < 160 / 1280, "andou para a esquerda");
  assert.equal(main.getAttribute("aria-describedby"), "lu-lb-hint", "leitor de tela sabe como mover");

  w.destroy();
  localStorage.clear();
  boot(cfg({ launcher: { draggable: false } }));
  const m2 = $(".lb-main")!;
  const ev = (type: string, x: number, y: number) =>
    m2.dispatchEvent(new (window as any).PointerEvent(type, { bubbles: true, composed: true, pointerId: 8, button: 0, clientX: x, clientY: y }));
  ev("pointerdown", 160, 118);
  ev("pointermove", 400, 300);
  ev("pointerup", 400, 300);
  assert.equal(localStorage.getItem("luumu_a11y_pk_test:anon"), null, "nada salvo");
  assert.equal(($(".launcher") as HTMLElement).style.bottom, "24px");
  assert.equal(m2.getAttribute("aria-describedby"), null);
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

/* ---------------- plataforma externa (lib/accessibility/integration.ts) ---------------- */

const extCfg = (over: Record<string, unknown> = {}) =>
  cfg({ integration: { mode: "external", webhookUrl: "https://plataforma.example.com/hook" }, nudge: { enabled: true, audience: "targeted", delay: 0 }, ...over });

test("modo externo: sem setUser não há convite nem chamadas à Luumu; setUser com invite mostra os perfis da plataforma", async () => {
  identity = { id: "ext-1" };
  boot(extCfg());
  await sleep(30);
  assert.equal($(".mwrap"), null, "espera a plataforma dizer quem é convidado");
  assert.equal(calls("prefs").length + calls("match").length, 0, "nada de lista nem preferências na Luumu");
  (w as any).setExternal({ invite: true, profiles: ["calma", "libras"], status: "pending" });
  await sleep(30);
  assert.ok($(".mwrap"), "convite exibido");
  const cards = [...shadow().querySelectorAll(".n-card")].map((c) => c.textContent!);
  assert.equal(cards.length, 2, "só os perfis que a plataforma mandou");
  assert.match(cards[0], /Tela mais calma/);
  assert.equal(calls("prefs").length + calls("match").length, 0);
});

test("modo externo: status accepted/dismissed ou invite false não mostram o convite", async () => {
  for (const state of [{ invite: true, status: "accepted" }, { invite: true, status: "dismissed" }, { invite: false }]) {
    w.destroy();
    sessionStorage.clear();
    identity = { id: "ext-2" };
    boot(extCfg());
    (w as any).setExternal(state);
    await sleep(30);
    assert.equal($(".mwrap"), null, JSON.stringify(state));
  }
});

test("modo externo: adota as escolhas da plataforma, e um reenvio antigo não desfaz a mudança feita aqui", async () => {
  identity = { id: "ext-3" };
  boot(extCfg());
  (w as any).setExternal({ invite: false, prefs: { highlightLinks: true, textSize: 2 } });
  assert.ok(html().classList.contains("lu-a11y-links"), "escolha salva na plataforma aplicada");
  click($('[data-a="open"]'));
  click($('[data-k="sw:highlightLinks"]')); // estudante desliga aqui
  assert.equal(html().classList.contains("lu-a11y-links"), false);
  (w as any).setExternal({ invite: false, prefs: { highlightLinks: true, textSize: 2 } }); // eco antigo
  assert.equal(html().classList.contains("lu-a11y-links"), false, "a mudança do estudante vence o eco");
  (w as any).setExternal({ invite: false, prefs: { highlightLinks: true, textSize: 2 } }); // plataforma insiste: é a configuração nova
  assert.ok(html().classList.contains("lu-a11y-links"));
  assert.equal((w as any).getState().prefs.textSize, 2);
});

test("modo externo: cada mudança sai na hora (evento no navegador, onEvent e webhook pela Luumu)", async () => {
  identity = { id: "ext-4", email: "bia@escola.br" };
  const seen: any[] = [];
  const onWindow = (e: Event) => seen.push({ via: "window", ...(e as CustomEvent).detail });
  window.addEventListener("luumu:accessibility", onWindow);
  const viaBoot: any[] = [];
  boot(extCfg(), { onEvent: (e: any) => viaBoot.push(e) });
  (w as any).setExternal({ invite: true, profiles: ["leitura"] });
  await sleep(30);
  click($('[data-n="accept"]'));
  await sleep(10);
  click($('[data-a="open"]'));
  click($('[data-k="sw:highlightLinks"]'));
  await sleep(10);
  window.removeEventListener("luumu:accessibility", onWindow);

  const types = seen.map((e) => e.event);
  assert.ok(types.includes("invite.shown"), types.join());
  assert.ok(types.includes("invite.accepted"), types.join());
  assert.ok(types.filter((t) => t === "prefs.updated").length >= 2, "aceitar o perfil e ligar o recurso");
  assert.equal(viaBoot.length, seen.length, "onEvent recebe o mesmo que o evento do navegador");
  const last = seen.at(-1);
  assert.equal(last.event, "prefs.updated");
  assert.deepEqual(last.user, { id: "ext-4", email: "bia@escola.br" });
  assert.equal(last.host, "app.escola.com");
  assert.equal(last.prefs.highlightLinks, true);
  assert.deepEqual(last.changes, [{ field: "highlightLinks", from: false, to: true }]);
  const accepted = seen.find((e) => e.event === "invite.accepted");
  assert.deepEqual(accepted.invite, { status: "accepted", profiles: ["leitura"] });

  const relayed = calls("events").map((c) => c.body);
  assert.equal(relayed.length, seen.length, "cada evento também vai para o webhook");
  assert.equal(relayed.at(-1).event, "prefs.updated");
  assert.equal(relayed.at(-1).id, "ext-4");
  assert.equal(relayed.at(-1).eventId, last.id, "mesmo id: a plataforma descarta repetidos");
});

test("sem webhook configurado ou estudante anônimo, nada é repassado pela Luumu (o evento no navegador continua)", async () => {
  let n = 0;
  const count = () => n++;
  window.addEventListener("luumu:accessibility", count);
  identity = { id: "ext-5" };
  boot(cfg({ integration: { mode: "external", webhookUrl: "" } }));
  click($('[data-a="open"]'));
  click($('[data-k="sw:highlightLinks"]'));
  w.destroy();
  identity = {};
  boot(extCfg());
  click($('[data-a="open"]'));
  click($('[data-k="sw:highlightLinks"]'));
  await sleep(10);
  window.removeEventListener("luumu:accessibility", count);
  assert.equal(calls("events").length, 0);
  assert.equal(n, 2);
});
