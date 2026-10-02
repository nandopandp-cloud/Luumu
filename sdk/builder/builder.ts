/**
 * Luumu Builder (overlay) — carregado pelo core só quando a aba foi aberta pelo painel com
 * ?luumu_builder=<token>. Compilado para /public/sdk-builder.js.
 *
 * O administrador vê o produto real (com a sessão dele) e uma camada da Luumu por cima:
 *  - modo Selecionar: contorno no hover, clique abre o painel do elemento (o clique NÃO
 *    chega na aplicação);
 *  - modo Navegar: a aplicação funciona normalmente, para ir até outra tela;
 *  - cada tela visitada passa pelo Product Discovery Engine e vai para o Element Registry.
 * Nada é publicado daqui: os passos entram no rascunho do tour.
 */
import { STRATEGY_LABEL } from "../../lib/tours/target";
import { esc } from "../../lib/tours/render";
import type { ElementKind, ElementTarget, StepType } from "../../lib/tours/types";
import { actionableFrom, describeElement, isLuumuNode, LUUMU_HOST_ATTR } from "../shared/dom";
import { clearSession } from "../shared/memory";
import { discover } from "./discovery";

interface BuilderContext {
  api: string;
  origin: string; // origem do painel Luumu (para postMessage)
  key: string;
  token: string;
}

interface SessionInfo {
  id: string;
  name: string;
  steps: { key: string; type: string; title: string; route: string | null; hasTarget: boolean }[];
  retargetStepKey: string | null;
}

const KIND_LABEL: Record<ElementKind, string> = {
  button: "Botão",
  link: "Link",
  navigation: "Item de navegação",
  input: "Campo",
  select: "Seleção",
  tab: "Aba",
  menu: "Menu",
  card: "Card",
  other: "Elemento",
};

const CSS = `
:host { all: initial; }
* { box-sizing: border-box; font-family: 'Plus Jakarta Sans','Inter',system-ui,-apple-system,sans-serif; }
.bar { position: fixed; top: 12px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 10px;
  background: #fff; color: #0D0F1A; border: 1px solid #ECE6F8; border-radius: 16px; padding: 8px 8px 8px 14px;
  box-shadow: 0 18px 50px rgba(75,28,171,.22), 0 2px 6px rgba(13,15,26,.08); pointer-events: auto; max-width: calc(100vw - 24px);
  font-size: 13px; }
.logo { display: flex; align-items: center; gap: 8px; font-weight: 800; letter-spacing: -.01em; white-space: nowrap; }
.dot { width: 22px; height: 22px; border-radius: 8px; background: linear-gradient(135deg,#6B2BD9,#7ED957); }
.tour { color: #5B6072; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px; }
.pill { background: #F3EDFF; color: #6B2BD9; border-radius: 999px; padding: 3px 9px; font-weight: 700; font-size: 12px; white-space: nowrap; }
.seg { display: inline-flex; background: #F6F2FE; border-radius: 999px; padding: 3px; }
.seg button { border: 0; background: transparent; color: #5B6072; font-weight: 700; font-size: 12.5px; padding: 6px 12px; border-radius: 999px; cursor: pointer; }
.seg button.on { background: #fff; color: #6B2BD9; box-shadow: 0 1px 3px rgba(13,15,26,.12); }
.btn { border: 0; border-radius: 12px; padding: 8px 14px; font-weight: 700; font-size: 13px; cursor: pointer; white-space: nowrap; }
.primary { background: #6B2BD9; color: #fff; }
.primary:hover { background: #5B21C2; }
.ghost { background: #F3F4F6; color: #0D0F1A; }
.btn:focus-visible, .seg button:focus-visible { outline: 3px solid #6B2BD955; outline-offset: 2px; }
.hint { position: fixed; top: 70px; left: 50%; transform: translateX(-50%); background: #4B1CAB; color: #fff; font-size: 12.5px;
  font-weight: 600; padding: 7px 12px; border-radius: 10px; pointer-events: none; box-shadow: 0 8px 24px rgba(75,28,171,.3); }
.box { position: fixed; border: 2px solid #6B2BD9; background: rgba(107,43,217,.08); border-radius: 8px; pointer-events: none;
  transition: all .08s ease-out; }
.box.sel { border-color: #7ED957; background: rgba(126,217,87,.12); }
.tag { position: absolute; left: -2px; top: -26px; background: #6B2BD9; color: #fff; font-size: 11.5px; font-weight: 700;
  padding: 3px 8px; border-radius: 8px 8px 8px 2px; white-space: nowrap; max-width: 320px; overflow: hidden; text-overflow: ellipsis; }
.panel { position: fixed; right: 16px; top: 76px; width: 340px; max-width: calc(100vw - 32px); max-height: calc(100vh - 96px);
  overflow: auto; background: #fff; color: #0D0F1A; border: 1px solid #ECE6F8; border-radius: 18px; padding: 18px;
  box-shadow: 0 24px 60px rgba(75,28,171,.22); pointer-events: auto; }
.eyebrow { font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #6B2BD9; }
h3 { margin: 6px 0 12px; font-size: 18px; font-weight: 800; letter-spacing: -.01em; }
dl { display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; margin: 0 0 14px; font-size: 12.5px; }
dt { color: #5B6072; font-weight: 600; }
dd { margin: 0; font-weight: 600; word-break: break-word; }
.meter { height: 6px; border-radius: 6px; background: #F3F4F6; overflow: hidden; margin-top: 4px; }
.meter i { display: block; height: 100%; border-radius: 6px; }
.tip { font-size: 12px; color: #92400E; background: #FEF3C7; border-radius: 10px; padding: 8px 10px; margin: 0 0 12px; line-height: 1.45; }
.tip code { font-family: 'JetBrains Mono',ui-monospace,monospace; font-size: 11px; }
label { display: block; font-size: 12px; font-weight: 700; color: #5B6072; margin: 10px 0 5px; }
input, textarea, select { width: 100%; border: 1px solid #E5E0F0; border-radius: 10px; padding: 9px 11px; font-size: 13.5px;
  color: #0D0F1A; background: #fff; outline: none; }
input:focus, textarea:focus, select:focus { border-color: #6B2BD9; box-shadow: 0 0 0 3px #6B2BD922; }
textarea { resize: vertical; min-height: 64px; }
.row { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
.toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: #0D0F1A; color: #fff; font-size: 13px;
  font-weight: 600; padding: 10px 16px; border-radius: 12px; pointer-events: none; box-shadow: 0 10px 30px rgba(0,0,0,.3); }
.err { background: #B91C1C; }
`;

function safe(fn: () => void) {
  try {
    fn();
  } catch {}
}

export function bootBuilder(c: BuilderContext) {
  let mode: "select" | "navigate" = "select";
  // o token traz o passo a retargetar; depois de feito, o resto da sessão é de adicionar passos
  let retargetDone = false;
  let session: SessionInfo | null = null;
  let hovered: Element | null = null;
  let selected: Element | null = null;
  const sentRoutes: Record<string, number> = {};

  const host = document.createElement("div");
  host.setAttribute(LUUMU_HOST_ATTR, "builder");
  host.style.cssText = "position:fixed;inset:0;z-index:2147483646;pointer-events:none;";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>${CSS}</style>
    <div class="bar" role="toolbar" aria-label="Luumu Builder">
      <span class="logo"><span class="dot"></span>Luumu Builder</span>
      <span class="tour" data-el="tour">Carregando…</span>
      <span class="pill" data-el="count">0 passos</span>
      <span class="seg" role="radiogroup" aria-label="Modo">
        <button type="button" data-mode="select" class="on" role="radio" aria-checked="true">Selecionar elemento</button>
        <button type="button" data-mode="navigate" role="radio" aria-checked="false">Navegar</button>
      </span>
      <button type="button" class="btn primary" data-act="done">Concluir</button>
    </div>
    <div class="hint" data-el="hint">Passe o mouse e clique no elemento que o passo deve destacar</div>
    <div class="box" data-el="hover" hidden><span class="tag" data-el="hovertag"></span></div>
    <div class="box sel" data-el="sel" hidden></div>
    <div data-el="panel"></div>
    <div data-el="toast"></div>`;
  document.documentElement.appendChild(host);

  const $ = (k: string) => root.querySelector(`[data-el="${k}"]`) as HTMLElement;
  const hoverBox = $("hover");
  const selBox = $("sel");

  const toast = (msg: string, error = false) => {
    const t = $("toast");
    t.innerHTML = `<div class="toast${error ? " err" : ""}" role="status">${esc(msg)}</div>`;
    setTimeout(() => (t.innerHTML = ""), 2600);
  };

  const notifyPanel = () =>
    safe(() => window.opener?.postMessage({ type: "luumu:tour-updated", tourId: session?.id }, c.origin));

  async function loadSession() {
    try {
      const r = await fetch(`${c.api}/builder/session?token=${encodeURIComponent(c.token)}&key=${encodeURIComponent(c.key)}`);
      const d = await r.json();
      if (!r.ok) {
        toast(d.error || "Sessão do builder inválida.", true);
        return;
      }
      session = d as SessionInfo;
      if (retargetDone) session.retargetStepKey = null;
      $("tour").textContent = session.name;
      $("count").textContent = `${session.steps.length} ${session.steps.length === 1 ? "passo" : "passos"}`;
      if (session.retargetStepKey) {
        const s = session.steps.find((x) => x.key === session!.retargetStepKey);
        $("hint").textContent = `Escolha o novo alvo do passo "${s?.title || "selecionado"}"`;
      }
    } catch {
      toast("Não foi possível falar com a Luumu.", true);
    }
  }

  function setMode(m: "select" | "navigate") {
    mode = m;
    root.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((b) => {
      const on = b.dataset.mode === m;
      b.classList.toggle("on", on);
      b.setAttribute("aria-checked", String(on));
    });
    $("hint").hidden = m !== "select";
    hoverBox.hidden = true;
    if (m === "navigate") closePanel();
  }

  function frame(box: HTMLElement, el: Element) {
    const r = el.getBoundingClientRect();
    box.style.left = `${r.left - 3}px`;
    box.style.top = `${r.top - 3}px`;
    box.style.width = `${r.width + 6}px`;
    box.style.height = `${r.height + 6}px`;
    box.hidden = false;
  }

  function closePanel() {
    selected = null;
    selBox.hidden = true;
    $("panel").innerHTML = "";
  }

  function openPanel(el: Element) {
    selected = el;
    frame(selBox, el);
    const t = describeElement(el);
    const retarget = !!session?.retargetStepKey;
    const stab = Math.round(t.stability * 100);
    const color = stab >= 75 ? "#16A34A" : stab >= 50 ? "#D97706" : "#DC2626";
    const panel = $("panel");
    panel.innerHTML = `<div class="panel" role="dialog" aria-label="Elemento selecionado">
      <div class="eyebrow">Elemento selecionado</div>
      <h3>${esc(t.label)}</h3>
      <dl>
        <dt>Tipo</dt><dd>${KIND_LABEL[t.kind]}</dd>
        <dt>Página</dt><dd>${esc(location.pathname)}</dd>
        <dt>Identificação</dt><dd>${esc(STRATEGY_LABEL[t.strategy])}
          <div class="meter" title="Estabilidade ${stab}%"><i style="width:${stab}%;background:${color}"></i></div></dd>
      </dl>
      ${
        t.stability < 0.5
          ? `<p class="tip">Este elemento é difícil de reencontrar se a tela mudar. Para garantir, peça ao time técnico para adicionar <code>data-luumu-id="${esc(
              suggestId(t)
            )}"</code> nele.</p>`
          : ""
      }
      ${
        retarget
          ? ""
          : `<label for="lb-type">Tipo do passo</label>
        <select id="lb-type">
          <option value="tooltip">Tooltip com destaque</option>
          <option value="popover">Popover</option>
          <option value="spotlight">Spotlight</option>
        </select>
        <label for="lb-title">Título</label>
        <input id="lb-title" maxlength="120" value="${esc(t.label.slice(0, 80))}" />
        <label for="lb-body">Descrição</label>
        <textarea id="lb-body" maxlength="600" placeholder="Explique o que o usuário encontra aqui."></textarea>`
      }
      <div class="row">
        <button type="button" class="btn ghost" data-act="cancel">Cancelar</button>
        <button type="button" class="btn primary" data-act="save">${retarget ? "Definir como alvo" : "Adicionar ao tour"}</button>
      </div>
    </div>`;
    (panel.querySelector(retarget ? "[data-act=save]" : "#lb-title") as HTMLElement | null)?.focus();
    panel.querySelector("[data-act=save]")!.addEventListener("click", () => void save(t));
  }

  function suggestId(t: ElementTarget): string {
    const base = (t.label || t.tag)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    return base || "elemento";
  }

  async function save(t: ElementTarget) {
    const panel = $("panel");
    const retarget = !!session?.retargetStepKey;
    const val = (sel: string) => (panel.querySelector(sel) as HTMLInputElement | null)?.value ?? "";
    const body = {
      token: c.token,
      key: c.key,
      action: retarget ? "retarget" : "add",
      stepKey: session?.retargetStepKey ?? undefined,
      target: t,
      route: location.pathname,
      type: (val("#lb-type") || "tooltip") as StepType,
      title: val("#lb-title"),
      body: val("#lb-body"),
    };
    try {
      const r = await fetch(`${c.api}/builder/steps`, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) return toast(d.error || "Não foi possível salvar.", true);
      closePanel();
      toast(retarget ? "Alvo atualizado no rascunho." : "Passo adicionado ao rascunho do tour.");
      notifyPanel();
      if (retarget) {
        retargetDone = true;
        if (session) session.retargetStepKey = null;
      }
      void loadSession();
      if (retarget) $("hint").textContent = "Passe o mouse e clique no elemento que o passo deve destacar";
    } catch {
      toast("Sem conexão com a Luumu.", true);
    }
  }

  /* ---------- discovery por rota ---------- */
  let discoverTimer: ReturnType<typeof setTimeout> | null = null;
  function scheduleDiscovery(delay = 1200) {
    if (discoverTimer) clearTimeout(discoverTimer);
    discoverTimer = setTimeout(() => safe(runDiscovery), delay);
  }
  function runDiscovery() {
    const result = discover();
    const sig = result.elements.length;
    // mesma rota com o mesmo número de elementos nos últimos 20s: nada novo para mandar
    const last = sentRoutes[result.route];
    if (last && Date.now() - last < 20_000 && sig === (sentRoutes[`${result.route}#n`] ?? -1)) return;
    sentRoutes[result.route] = Date.now();
    sentRoutes[`${result.route}#n`] = sig;
    fetch(`${c.api}/builder/discovery`, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ token: c.token, key: c.key, ...result }),
    }).catch(() => {});
  }

  /* ---------- eventos ---------- */
  const fromEvent = (e: Event): Element | null => {
    const t = e.target as Element | null;
    if (!t || !(t instanceof Element) || t === host || isLuumuNode(t)) return null;
    return actionableFrom(t);
  };

  window.addEventListener(
    "pointermove",
    (e) =>
      safe(() => {
        if (mode !== "select") return;
        const el = fromEvent(e);
        if (!el || el === document.documentElement || el === document.body) {
          hoverBox.hidden = true;
          hovered = null;
          return;
        }
        if (el !== hovered) {
          hovered = el;
          $("hovertag").textContent = `Selecionar elemento · ${describeElement(el).label}`;
        }
        frame(hoverBox, el);
      }),
    true
  );

  // no modo seleção o clique é da Luumu: a aplicação não recebe nada
  const block = (e: Event) => {
    if (mode !== "select") return;
    const el = fromEvent(e);
    if (!el) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.type === "click") safe(() => openPanel(el));
  };
  for (const type of ["click", "mousedown", "mouseup", "pointerdown", "pointerup", "touchstart", "submit", "dblclick"]) {
    window.addEventListener(type, block, { capture: true, passive: false });
  }

  root.addEventListener("click", (e) => {
    const t = (e.target as Element).closest("[data-mode],[data-act]") as HTMLElement | null;
    if (!t) return;
    if (t.dataset.mode) setMode(t.dataset.mode as "select" | "navigate");
    else if (t.dataset.act === "cancel") closePanel();
    else if (t.dataset.act === "done") {
      clearSession("luumu_builder_token");
      notifyPanel();
      host.remove();
      location.reload();
    }
  });

  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape" && selected) {
        e.stopImmediatePropagation();
        closePanel();
      }
    },
    true
  );

  const reframe = () => {
    if (selected?.isConnected) frame(selBox, selected);
    if (hovered?.isConnected && !hoverBox.hidden) frame(hoverBox, hovered);
  };
  window.addEventListener("scroll", reframe, true);
  window.addEventListener("resize", reframe);

  // SPA: rota nova → discovery de novo; DOM mudando muito na mesma rota também
  let lastPath = location.pathname;
  setInterval(() => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      closePanel();
      scheduleDiscovery(900);
    }
  }, 500);
  const mo = new MutationObserver(() => scheduleDiscovery(2500));
  mo.observe(document.body, { childList: true, subtree: true });

  void loadSession();
  scheduleDiscovery(600);
}

(window as unknown as { __luumuBuilder?: { boot: typeof bootBuilder } }).__luumuBuilder = { boot: bootBuilder };
