/*
  Gravador de heatmaps — bundle sob demanda (/sdk-heatmaps.js). O core (sdk/luumu.ts) só o
  baixa quando o /config diz que o projeto ativou os heatmaps.

  Por visita a uma página registra cliques e movimento ANCORADOS NO ELEMENTO (seletor +
  posição dentro dele), tempo de cursor sobre elementos, a profundidade máxima de rolagem e
  de cursor, o caminho de cliques e o tempo ativo. Envia uma vez, ao sair da página (aba
  oculta, fechamento ou troca de rota em SPA), com sendBeacon.

  Uma vez por página/dispositivo (quando o servidor pede) envia também a cópia da página que
  serve de fundo do mapa: HTML sem scripts, sem valores de campos e com dados pessoais
  mascarados (e-mails, números longos e tudo dentro de [data-luumu-mask]).

  Desempenho: listeners passivos, movimento amostrado a cada 100 ms, nada de layout em
  laço; a cópia é feita só quando o navegador está ocioso.
*/
import { isStableId } from "../../lib/tours/target";
import { LIMITS, MOVE_GRID, SNAPSHOT_MAX_BYTES, type HeatmapDevice, type PageviewPayload } from "../../lib/heatmaps/core";
import { LUUMU_HOST_ATTR, cssEscape } from "../shared/dom";

export interface HeatmapsBootConfig {
  api: string;
  key: string;
  host: string;
  device: HeatmapDevice;
  /** rota normalizada da página atual ("home", "cursos/:id") */
  path: () => string;
  /** fração das sessões gravadas (definida pelo servidor) — vai junto em cada visita */
  rate: number;
  /** "dispositivo|rota" que já têm cópia recente: nem pergunta ao servidor */
  fresh: string[];
  /** pede ao core para enviar agora (fila grande) */
  requestFlush: () => void;
}

/** Uma visita pronta para envio (o core acrescenta key e host no envio único). */
export type HeatmapVisit = Omit<PageviewPayload, "key" | "host">;

export interface HeatmapsRecorder {
  boot(cfg: HeatmapsBootConfig): void;
  /** troca de rota em SPA: fecha a visita atual e começa outra (vai para a fila, sem envio) */
  route(): void;
  /** fecha a visita atual e entrega a fila ao core, que faz UM envio junto com o analytics */
  collect(): HeatmapVisit[];
}

const INTERACTIVE = "a[href],button,input,select,textarea,summary,label,[role=button],[role=link],[role=tab],[role=menuitem],[role=checkbox],[role=radio],[data-luumu-track]";
const IDLE_MS = 30_000;
const MOVE_SAMPLE_MS = 100;
const SNAP_STAMP = "luumu_hm_snap_";
const SNAP_RECHECK_MS = 24 * 60 * 60 * 1000;

let cfg: HeatmapsBootConfig | null = null;

/* ---------- seletor estável ---------- */

const selCache = new WeakMap<Element, string>();

/** Caminho CSS do elemento até o body (ou até um id estável), com nth-of-type onde precisa. */
export function selectorOf(el: Element): string {
  const cached = selCache.get(el);
  if (cached && el.isConnected) return cached;
  const parts: string[] = [];
  let cur: Element | null = el;
  for (let i = 0; cur && i < 14 && cur !== document.body && cur !== document.documentElement; i++) {
    const id = cur.getAttribute("id");
    if (id && isStableId(id)) {
      parts.unshift(`#${cssEscape(id)}`);
      break;
    }
    const tag = cur.tagName.toLowerCase();
    const parent: Element | null = cur.parentElement;
    if (!parent) {
      parts.unshift(tag);
      break;
    }
    let idx = 0;
    let same = 0;
    for (const c of Array.from(parent.children)) {
      if (c.tagName === cur.tagName) {
        same++;
        if (c === cur) idx = same;
      }
    }
    parts.unshift(same > 1 ? `${tag}:nth-of-type(${idx})` : tag);
    cur = parent;
  }
  if (cur === document.body || (cur && cur.parentElement === null)) parts.unshift("body");
  const s = parts.join(">").slice(0, LIMITS.selector);
  selCache.set(el, s);
  return s;
}

function labelOf(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") {
    const i = el as HTMLInputElement;
    // nunca o valor digitado: só o que nomeia o campo
    if (i.type === "submit" || i.type === "button") return i.value || "";
    return i.getAttribute("aria-label") || i.placeholder || i.name || tag;
  }
  const aria = el.getAttribute("aria-label");
  if (aria) return aria;
  if (el.closest("[data-luumu-mask]")) return "•••";
  const t = (el.textContent || "").replace(/\s+/g, " ").trim();
  return t || el.querySelector("img[alt]")?.getAttribute("alt") || tag;
}

/** Elemento "que conta" para clique e hover: o interativo mais próximo (até 5 níveis). */
function anchorOf(target: Element): Element {
  let cur: Element | null = target;
  for (let i = 0; cur && i < 5; i++) {
    if (cur.matches(INTERACTIVE)) return cur;
    cur = cur.parentElement;
  }
  return target;
}

const isOurs = (el: Element) => !!el.closest(`[${LUUMU_HOST_ATTR}],#luumu-root`);
/*
  Altura rolável da JANELA (scrollingElement = <html> no modo padrão). Não usar o maior entre
  html e body: quando é o <body> que rola por dentro, body.scrollHeight é o conteúdo do painel
  e faria parecer que a janela rola.
*/
const docHeight = () => Math.max((document.scrollingElement ?? document.documentElement).scrollHeight, 1);
/** a JANELA rola? (apps de página única costumam ter a página do tamanho da tela) */
const docScrolls = () => docHeight() > window.innerHeight + 4;

/*
  Painel principal com rolagem interna (o div que rola quando a janela não rola). Descoberto
  no primeiro scroll dentro dele ou, se ninguém rolou, por uma varredura única ao enviar.
*/
let scroller: HTMLElement | null = null;
const isScroller = (el: Element): el is HTMLElement =>
  el instanceof HTMLElement && el.scrollHeight > el.clientHeight + 24 && el.clientHeight >= window.innerHeight * 0.35;

function findScroller(): HTMLElement | null {
  if (scroller?.isConnected) return scroller;
  let best: HTMLElement | null = null;
  // o próprio <body> pode ser o painel que rola (html com a altura da tela, body com overflow)
  const body = document.body;
  if (body && isScroller(body) && /auto|scroll/.test(getComputedStyle(body).overflowY)) best = body;
  const all = document.body?.querySelectorAll("*") ?? [];
  for (let i = 0; i < all.length && i < 4000; i++) {
    const el = all[i];
    if (!isScroller(el)) continue;
    const oy = getComputedStyle(el).overflowY;
    if ((oy === "auto" || oy === "scroll") && (!best || el.scrollHeight > best.scrollHeight)) best = el;
  }
  return (scroller = best);
}

/**
 * Profundidade (0–100) vista: da janela ou, se ela não rola, do painel interno. Janela parada
 * sem painel conhecido = ainda não sabemos (0); o envio resolve (flush).
 */
function viewDepth(): number {
  if (docScrolls()) return Math.min(100, Math.round(((window.scrollY + window.innerHeight) / docHeight()) * 100));
  if (!scroller) return 0;
  return Math.min(100, Math.round(((scroller.scrollTop + scroller.clientHeight) / scroller.scrollHeight) * 100));
}

/** Profundidade (0–100) de um ponto da tela na página (ou no painel interno). */
function pointDepth(clientY: number, pageY: number): number {
  if (docScrolls() || !scroller) return Math.min(100, Math.round((pageY / Math.max(docHeight(), window.innerHeight)) * 100));
  const r = scroller.getBoundingClientRect();
  return Math.min(100, Math.max(0, Math.round(((clientY - r.top + scroller.scrollTop) / scroller.scrollHeight) * 100)));
}

/* ---------- visita atual ---------- */

interface Visit {
  path: string;
  clicks: PageviewPayload["c"];
  moves: Record<string, number>;
  hovers: Record<string, number>;
  labels: Record<string, string>;
  path_: string[];
  sd: number;
  md: number;
  activeMs: number;
  sent: boolean;
}

let visit: Visit | null = null;
let lastInput = Date.now();
let lastMove = 0;

const sid = (() => {
  try {
    let v = sessionStorage.getItem("luumu_hm_sid");
    if (!v) {
      v = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem("luumu_hm_sid", v);
    }
    return v;
  } catch {
    return Math.random().toString(36).slice(2);
  }
})();

function newVisit(): Visit {
  return { path: cfg!.path(), clicks: [], moves: {}, hovers: {}, labels: {}, path_: [], sd: 0, md: 0, activeMs: 0, sent: false };
}

function remember(v: Visit, el: Element, sel: string) {
  if (!(sel in v.labels) && Object.keys(v.labels).length < 80) v.labels[sel] = labelOf(el).slice(0, LIMITS.label);
}

function onClick(e: MouseEvent) {
  const v = visit;
  const t = e.target as Element | null;
  if (!v || !t || !(t instanceof Element) || isOurs(t)) return;
  lastInput = Date.now();
  const el = anchorOf(t);
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return;
  const sel = selectorOf(el);
  if (v.clicks.length < LIMITS.clicks) {
    v.clicks.push([sel, Math.round(((e.clientX - r.left) / r.width) * 1000), Math.round(((e.clientY - r.top) / r.height) * 1000)]);
  }
  if (v.path_[v.path_.length - 1] !== sel && v.path_.length < LIMITS.path) v.path_.push(sel);
  remember(v, el, sel);
}

function onMove(e: MouseEvent) {
  const now = Date.now();
  lastInput = now;
  if (now - lastMove < MOVE_SAMPLE_MS) return;
  lastMove = now;
  const v = visit;
  const t = e.target as Element | null;
  if (!v || !t || !(t instanceof Element) || isOurs(t)) return;
  const r = t.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return;
  const sel = selectorOf(t);
  const gx = Math.min(MOVE_GRID - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * MOVE_GRID)));
  const gy = Math.min(MOVE_GRID - 1, Math.max(0, Math.floor(((e.clientY - r.top) / r.height) * MOVE_GRID)));
  const k = `${sel}|${gx}|${gy}`;
  if (k in v.moves) v.moves[k]++;
  else if (Object.keys(v.moves).length < LIMITS.moveCells) v.moves[k] = 1;

  const a = anchorOf(t);
  if (a !== t || a.matches(INTERACTIVE)) {
    const as = selectorOf(a);
    if (as in v.hovers) v.hovers[as] += MOVE_SAMPLE_MS;
    else if (Object.keys(v.hovers).length < LIMITS.hovers) v.hovers[as] = MOVE_SAMPLE_MS;
    remember(v, a, as);
  }
  v.md = Math.max(v.md, pointDepth(e.clientY, e.pageY));
}

let scrollQueued = false;
function measureScroll() {
  scrollQueued = false;
  if (!visit) return;
  visit.sd = Math.max(visit.sd, viewDepth());
}
function onScroll(e: Event) {
  lastInput = Date.now();
  // scroll dentro de um painel grande: ele passa a ser a referência de profundidade
  const t = e.target;
  if (t instanceof Element && t !== document.documentElement && !docScrolls() && isScroller(t) && (!scroller || t.scrollHeight >= scroller.scrollHeight)) scroller = t;
  if (scrollQueued) return;
  scrollQueued = true;
  requestAnimationFrame(measureScroll);
}

/*
  Fila de visitas: trocar de tela numa SPA não envia nada. Tudo vai num único envio quando a
  aba é ocultada ou fechada (core) — antes era um request por tela.
*/
let queue: HeatmapVisit[] = [];
let queuedBytes = 0;
const QUEUE_MAX_BYTES = 45_000;

function finalize() {
  const v = visit;
  if (!v || v.sent || !cfg) return;
  v.sent = true;
  // abriu e saiu sem ficar (pré-carregamento, aba em segundo plano): não é visita
  if (v.activeMs < 800 && !v.clicks.length) return;
  if (docScrolls()) measureScroll();
  else {
    // a janela não rola: vale o painel interno (achado agora se ninguém o rolou); sem painel,
    // a página inteira cabia na tela e foi vista toda
    findScroller();
    v.sd = scroller ? Math.max(v.sd, viewDepth()) : 100;
  }
  const payload: HeatmapVisit = {
    path: v.path,
    device: cfg.device,
    sid,
    vw: window.innerWidth,
    vh: window.innerHeight,
    // altura do conteúdo: a do painel interno quando é ele que rola
    dh: !docScrolls() && scroller ? Math.round(scroller.scrollHeight + scroller.getBoundingClientRect().top + window.scrollY) : docHeight(),
    dur: v.activeMs,
    sd: v.sd,
    md: v.md,
    c: v.clicks,
    m: v.moves,
    h: v.hovers,
    l: v.labels,
    p: v.path_,
    r: cfg.rate,
  };
  let size = JSON.stringify(payload).length;
  // sendBeacon tem teto (~64 KB): o movimento é o que cede primeiro
  if (size > 40_000) {
    payload.m = Object.fromEntries(Object.entries(payload.m).sort((a, b) => b[1] - a[1]).slice(0, 60));
    size = JSON.stringify(payload).length;
  }
  queue.push(payload);
  queuedBytes += size;
  if (queuedBytes > QUEUE_MAX_BYTES) cfg.requestFlush();
}

/* ---------- cópia da página ---------- */

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
const LONG_NUMBER = /\d[\d.\-/\s]{5,}\d/g;

/** HTML da página pronto para virar fundo do mapa: sem scripts, sem dados pessoais. */
export function serializePage(doc: Document = document): string {
  const clone = doc.documentElement.cloneNode(true) as HTMLElement;

  // estilos que só existem no CSSOM (CSS-in-JS insere regras sem texto no <style>)
  const orig = doc.querySelectorAll("style");
  const copies = clone.querySelectorAll("style");
  orig.forEach((s, i) => {
    try {
      const rules = (s as HTMLStyleElement).sheet?.cssRules;
      if (rules && rules.length && copies[i]) copies[i].textContent = Array.from(rules, (r) => r.cssText).join("\n");
    } catch {}
  });
  try {
    const adopted = (doc as Document & { adoptedStyleSheets?: CSSStyleSheet[] }).adoptedStyleSheets ?? [];
    for (const sheet of adopted) {
      const st = doc.createElement("style");
      st.textContent = Array.from(sheet.cssRules, (r) => r.cssText).join("\n");
      clone.querySelector("head")?.appendChild(st);
    }
  } catch {}

  clone.querySelectorAll(`script,noscript,template,[${LUUMU_HOST_ATTR}],#luumu-root,link[rel=preload],link[rel=modulepreload],link[rel=prefetch]`).forEach((n) => n.remove());
  clone.querySelectorAll("iframe,object,embed").forEach((n) => {
    const ph = doc.createElement("div");
    ph.setAttribute("style", `${n.getAttribute("style") ?? ""};background:#eef0f4;min-height:60px;`);
    ph.className = n.getAttribute("class") ?? "";
    n.replaceWith(ph);
  });
  clone.querySelectorAll("meta[http-equiv]").forEach((n) => n.remove());

  // campos: nunca o valor digitado
  clone.querySelectorAll("input").forEach((i) => {
    const type = (i.getAttribute("type") || "").toLowerCase();
    if (type !== "submit" && type !== "button") i.removeAttribute("value");
    i.removeAttribute("checked");
  });
  clone.querySelectorAll("textarea").forEach((t) => (t.textContent = ""));
  clone.querySelectorAll("option[selected]").forEach((o) => o.removeAttribute("selected"));

  // handlers inline e links javascript:
  clone.querySelectorAll("*").forEach((el) => {
    for (const a of Array.from(el.attributes)) {
      if (/^on/i.test(a.name)) el.removeAttribute(a.name);
      else if ((a.name === "href" || a.name === "src" || a.name === "action") && /^\s*javascript:/i.test(a.value)) el.removeAttribute(a.name);
    }
    if (el.tagName === "IMG" && el.getAttribute("loading") === "lazy") el.setAttribute("loading", "eager");
  });

  // texto: mascara o que o cliente marcou e o que parece dado pessoal
  const body = clone.querySelector("body");
  if (body) {
    const walker = doc.createTreeWalker(body, 4 /* NodeFilter.SHOW_TEXT */);
    const nodes: Text[] = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
    for (const n of nodes) {
      const masked = n.parentElement?.closest("[data-luumu-mask]");
      const v = n.nodeValue ?? "";
      n.nodeValue = masked ? v.replace(/\S/g, "•") : v.replace(EMAIL, "•••@•••").replace(LONG_NUMBER, (m) => m.replace(/\d/g, "•"));
    }
  }

  // URLs relativas passam a valer a partir do site do cliente
  const head = clone.querySelector("head");
  if (head) {
    head.querySelectorAll("base").forEach((b) => b.remove());
    const base = doc.createElement("base");
    base.setAttribute("href", location.href);
    head.insertBefore(base, head.firstChild);
  }
  clone.setAttribute("data-luumu-snapshot", "1");
  return `<!DOCTYPE html>${clone.outerHTML}`;
}

function idle(fn: () => void, delay: number) {
  setTimeout(() => {
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
    if (ric) ric(fn, { timeout: 4000 });
    else fn();
  }, delay);
}

async function gzip(text: string): Promise<Blob | null> {
  try {
    const CS = (window as unknown as { CompressionStream?: new (f: string) => GenericTransformStream }).CompressionStream;
    if (!CS) return null;
    const stream = new Blob([text]).stream().pipeThrough(new CS("gzip") as unknown as ReadableWritablePair<Uint8Array, Uint8Array>);
    return await new Response(stream).blob();
  } catch {
    return null;
  }
}

async function maybeSnapshot() {
  const c = cfg;
  if (!c) return;
  const path = c.path();
  // a lista do /config (em cache) já diz que existe cópia: nenhuma request
  if (c.fresh.includes(`${c.device}|${path}`)) return;
  const stamp = `${SNAP_STAMP}${c.host}:${path}:${c.device}`;
  try {
    const last = Number(localStorage.getItem(stamp) || 0);
    if (Date.now() - last < SNAP_RECHECK_MS) return;
    localStorage.setItem(stamp, String(Date.now()));
  } catch {}
  const q = `key=${encodeURIComponent(c.key)}&host=${encodeURIComponent(c.host)}&path=${encodeURIComponent(path)}&device=${c.device}`;
  try {
    const r = await fetch(`${c.api}/heatmaps/snapshot?${q}`);
    if (!r.ok || !(await r.json()).need) return;
    if (c.path() !== path) return; // o usuário já foi para outra tela
    const html = serializePage();
    if (html.length > SNAPSHOT_MAX_BYTES) return;
    // comprimida (gzip): a cópia tem centenas de KB e o HTML comprime ~10x
    const gz = await gzip(html);
    await fetch(`${c.api}/heatmaps/snapshot?${q}&w=${window.innerWidth}&h=${docHeight()}&vh=${window.innerHeight}${gz ? "&z=1" : ""}`, {
      method: "POST",
      body: gz ?? html,
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
    });
  } catch {}
}

/* ---------- ciclo de vida ---------- */

function startVisit() {
  visit = newVisit();
  scroller = null;
  measureScroll();
  // a janela não rola? procura o painel interno uma vez, com a página já montada
  idle(() => {
    if (!docScrolls()) findScroller();
    void maybeSnapshot();
  }, 2500);
}

const recorder: HeatmapsRecorder = {
  boot(c) {
    if (cfg) return;
    cfg = c;
    const opts = { capture: true, passive: true } as const;
    document.addEventListener("click", onClick, opts);
    document.addEventListener("mousemove", onMove, opts);
    // captura: scroll não borbulha, e o de painéis internos só chega assim
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    for (const ev of ["keydown", "touchstart", "pointerdown"]) document.addEventListener(ev, () => (lastInput = Date.now()), opts);
    // o envio (aba oculta/fechada) é do core, que junta heatmaps e analytics num request só
    // tempo ATIVO: aba visível e alguém interagiu nos últimos 30s
    setInterval(() => {
      if (visit && !document.hidden && Date.now() - lastInput < IDLE_MS) visit.activeMs += 1000;
    }, 1000);
    if (document.readyState === "complete") startVisit();
    else window.addEventListener("load", startVisit, { once: true });
  },
  route() {
    if (!cfg || !visit) return;
    if (cfg.path() === visit.path && !visit.sent) return; // replaceState na mesma tela
    finalize();
    startVisit();
  },
  collect() {
    finalize();
    const out = queue;
    queue = [];
    queuedBytes = 0;
    return out;
  },
};

(window as unknown as { __luumuHeatmaps?: HeatmapsRecorder }).__luumuHeatmaps = recorder;
