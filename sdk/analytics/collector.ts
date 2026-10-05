/*
  Coletor de Analytics de produto — bundle sob demanda (/sdk-analytics.js). O core
  (sdk/luumu.ts) só o baixa quando o /config diz que o projeto ativou o Analytics.

  Registra, por carregamento de página, as telas visitadas (rota normalizada), o tempo ATIVO
  em cada uma (aba visível + interação nos últimos 30s) e os eventos que aconteceram nela.
  Envia tudo num único sendBeacon ao sair (aba oculta, fechamento) — um request por
  carregamento, não por tela nem por evento.

  Sessão: compartilhada entre abas (localStorage); 30 min sem atividade abrem uma nova, com a
  origem (referência externa + UTMs) e a página de entrada.

  Cada tela tem um ID: se a aba é ocultada e volta, o tempo novo é SOMADO à mesma tela no
  servidor (não vira uma visualização nova).
*/
import { anonymousId } from "../shared/memory";
import { readPageIdentity, type CaptureConfig, type PageIdentity } from "./page-identity";
import { svgHash } from "../../lib/analytics/svg-avatar";
import { detectBrowser, detectOS, SESSION_IDLE_MS, LIMITS, type AnalyticsDevice, type AnalyticsPayload } from "../../lib/analytics/core";

export interface AnalyticsBootConfig {
  api: string;
  key: string;
  host: string;
  device: AnalyticsDevice;
  /** rota normalizada da tela atual */
  path: () => string;
  /** usuário identificado (Luumu.identify), se houver */
  identity: () => { id: string | null; email: string | null; name: string | null; avatar: string | null };
  /** pede ao core para enviar agora (virada de sessão, muitas telas acumuladas) */
  requestFlush: () => void;
  /** ler nome/foto da página quando o identify não manda (configuração da workspace) */
  capture?: CaptureConfig | null;
}

/** O que vai no envio (o core acrescenta key e host). */
export type AnalyticsBatch = Omit<AnalyticsPayload, "key" | "host">;

export interface AnalyticsCollector {
  boot(cfg: AnalyticsBootConfig): void;
  route(): void;
  event(name: string): void;
  /** entrega o que está pendente ao core, que faz UM envio junto com os heatmaps */
  collect(): AnalyticsBatch | null;
  /** diagnóstico (Luumu.debugIdentity): o que o identify mandou e o que a página mostra agora */
  peek(): { capture: CaptureConfig | null; identify: { id: string | null; email: string | null; name: string | null; avatar: string | null }; page: PageIdentity | null };
}

interface Page {
  id: string;
  path: string;
  t: number;
  /** tempo ainda não enviado */
  dur: number;
  /** eventos ainda não enviados */
  ev: Set<string>;
  sent: boolean;
}

interface Session {
  id: string;
  st: number;
  last: number;
  ref: string;
  utm: { source: string; medium: string; campaign: string };
  landing: string;
}

const SESSION_KEY = "luumu_an_session";
const IDLE_MS = 30_000;
const rand = () => (Math.random().toString(36).slice(2, 10) + Date.now().toString(36)).replace(/[^a-z0-9]/g, "").slice(0, 24);

let cfg: AnalyticsBootConfig | null = null;
let session: Session | null = null;
let pages: Page[] = [];
let lastInput = Date.now();

function loadSession(): Session | null {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || "null") as Session | null;
    return s && typeof s.id === "string" && typeof s.last === "number" ? s : null;
  } catch {
    return null;
  }
}
function saveSession() {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {}
}

/** Origem da sessão: referência EXTERNA (outro domínio) e UTMs da URL de entrada. */
function newSession(external: boolean): Session {
  let ref = "";
  try {
    const r = document.referrer ? new URL(document.referrer).hostname.toLowerCase() : "";
    if (external && r && r !== location.hostname.toLowerCase()) ref = r;
  } catch {}
  const q = new URLSearchParams(location.search);
  const utm = external
    ? { source: (q.get("utm_source") || "").slice(0, LIMITS.utm), medium: (q.get("utm_medium") || "").slice(0, LIMITS.utm), campaign: (q.get("utm_campaign") || "").slice(0, LIMITS.utm) }
    : { source: "", medium: "", campaign: "" };
  const now = Date.now();
  return { id: rand(), st: now, last: now, ref, utm, landing: cfg!.path() };
}

/** Sessão atual; 30 min parada = nova (e o que estava pendente vai na sessão antiga). */
function touchSession(now = Date.now()) {
  if (!session) {
    const saved = loadSession();
    // reabriu dentro de 30 min (outra aba, recarga): continua a mesma sessão
    session = saved && now - saved.last < SESSION_IDLE_MS ? saved : newSession(true);
  } else if (now - session.last >= SESSION_IDLE_MS) {
    // o pendente pertence à sessão antiga: sai agora, antes de virar
    cfg!.requestFlush();
    session = newSession(false);
    const cur = pages[pages.length - 1];
    pages = cur ? [{ ...cur, id: rand(), t: now, dur: 0, ev: new Set(), sent: false }] : [];
  }
  session.last = now;
  saveSession();
}

function startPage() {
  const path = cfg!.path();
  pages.push({ id: rand(), path, t: Date.now(), dur: 0, ev: new Set(), sent: false });
  if (pages.length >= LIMITS.pages) cfg!.requestFlush();
}

/*
  Nome/foto lidos da página: só no envio (a aba está saindo; nada roda durante o uso) e só para
  usuário identificado.

  Na detecção AUTOMÁTICA um valor só é aceito depois de aparecer IGUAL em duas telas diferentes
  da mesma pessoa: o perfil do usuário logado fica fixo no topo/menu, conteúdo (ranking, card
  de colega, personagem, ícone de matéria) muda de tela para tela. Confirmado, fica guardado no
  navegador (por pessoa) e vai já nas próximas visitas. Com seletores configurados, vale direto.
*/
const CONFIRMED = "luumu_idc_ok";
const SEEN = "luumu_idc_seen";
type Confirmed = { who: string; sig?: string; name: string | null; avatar: string | null; avsel?: boolean; svg?: string; svgh?: string };
// desenhos (SVG) já enviados deste navegador: depois da 1ª vez vai só a impressão digital
const SVG_SENT = "luumu_svg_sent";
type Seen = { who: string; n: Record<string, string[]>; a: Record<string, string[]> };
let lastScan = 0;

function readJson<T>(store: Storage, key: string): T | null {
  try {
    return JSON.parse(store.getItem(key) || "null") as T | null;
  } catch {
    return null;
  }
}
function writeJson(store: Storage, key: string, v: unknown) {
  try {
    store.setItem(key, JSON.stringify(v));
  } catch {}
}

function pageIdentity(c: AnalyticsBootConfig, who: string, email: string | null): Confirmed | null {
  if (!c.capture) return null;
  // trocou a configuração (ex.: automático → seletores): o que foi confirmado antes não vale
  const sig = `${c.capture.n}|${c.capture.a}`;
  const saved = readJson<Confirmed>(localStorage, CONFIRMED);
  const ok: Confirmed = saved?.who === who && saved.sig === sig ? saved : { who, sig, name: null, avatar: null };
  if ((ok.name && (ok.avatar || ok.svgh)) || Date.now() - lastScan < 15_000) return ok;
  lastScan = Date.now();

  const found = readPageIdentity(c.capture, document, email);
  if (c.capture.n || c.capture.a) {
    // seletores escolhidos pelo cliente: confia no que eles apontam
    ok.name = found.name ?? ok.name;
    if (found.avatar) {
      ok.avatar = found.avatar;
      ok.avsel = found.avatarFromSelector;
    } else if (found.avatarSvg && !ok.avatar) {
      ok.svg = found.avatarSvg;
      ok.svgh = svgHash(found.avatarSvg);
    }
  } else {
    const route = c.path();
    const prev = readJson<Seen>(sessionStorage, SEEN);
    const seen: Seen = prev?.who === who ? prev : { who, n: {}, a: {} };
    const confirm = (bucket: Record<string, string[]>, v: string | null) => {
      if (!v) return false;
      const routes = (bucket[v] ??= []);
      if (!routes.includes(route)) routes.push(route);
      // poucos candidatos por pessoa (o storage não cresce)
      const keys = Object.keys(bucket);
      if (keys.length > 8) delete bucket[keys[0]];
      return routes.length >= 2;
    };
    if (!ok.name && confirm(seen.n, found.name)) ok.name = found.name;
    if (!ok.avatar && confirm(seen.a, found.avatar)) ok.avatar = found.avatar;
    writeJson(sessionStorage, SEEN, seen);
  }
  writeJson(localStorage, CONFIRMED, ok);
  return ok;
}

function collect(): AnalyticsBatch | null {
  const c = cfg;
  if (!c || !session) return null;
  const send = pages.filter((p) => !p.sent || p.dur > 0 || p.ev.size > 0);
  if (!send.length) return null;
  const payload: AnalyticsBatch = {
    aid: anonymousId().replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64).padEnd(6, "0"),
    ...(() => {
      const who = c.identity();
      const page = (who.id || who.email) && (!who.name || !who.avatar) ? pageIdentity(c, who.id || who.email || "", who.email) : null;
      const avatar = who.avatar ?? page?.avatar ?? null;
      // avatar desenhado (SVG embutido): o desenho vai uma vez por navegador; depois, só a impressão
      let svg: { avsvgh?: string; avsvg?: string } = {};
      if (!avatar && page?.svgh) {
        const sent = readJson<string[]>(localStorage, SVG_SENT) ?? [];
        svg = sent.includes(page.svgh) ? { avsvgh: page.svgh } : { avsvgh: page.svgh, avsvg: page.svg };
        if (!sent.includes(page.svgh)) writeJson(localStorage, SVG_SENT, [...sent, page.svgh].slice(-20));
      }
      return { uid: who.id, email: who.email, name: who.name ?? page?.name ?? null, avatar, avsel: !who.avatar && !!page?.avsel && !!avatar, ...svg };
    })(),
    sid: session.id,
    st: session.st,
    device: c.device,
    os: detectOS(navigator.userAgent),
    browser: detectBrowser(navigator.userAgent),
    vw: window.innerWidth,
    ref: session.ref,
    utm: session.utm,
    landing: session.landing,
    pages: send.map((p) => ({ id: p.id, path: p.path, t: p.t, dur: p.dur, ev: [...p.ev], ...(p.sent ? { c: true } : {}) })),
  };
  for (const p of send) {
    p.sent = true;
    p.dur = 0;
    p.ev = new Set();
  }
  // só a tela atual continua aberta
  pages = pages.slice(-1);
  return payload;
}

const collector: AnalyticsCollector = {
  boot(c) {
    if (cfg) return;
    cfg = c;
    touchSession();
    startPage();
    const input = () => {
      lastInput = Date.now();
    };
    const opts = { capture: true, passive: true } as const;
    for (const ev of ["pointerdown", "keydown", "scroll", "touchstart", "mousemove"]) document.addEventListener(ev, input, opts);
    // o envio (aba oculta/fechada) é do core, que junta analytics e heatmaps num request só
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") touchSession();
    });
    // tempo ATIVO: aba visível e alguém interagiu nos últimos 30s
    setInterval(() => {
      const now = Date.now();
      if (document.hidden || now - lastInput > IDLE_MS) return;
      touchSession(now);
      const cur = pages[pages.length - 1];
      if (cur) cur.dur += 1000;
    }, 1000);
  },
  route() {
    if (!cfg) return;
    const cur = pages[pages.length - 1];
    if (cur && cur.path === cfg.path()) return; // replaceState na mesma tela
    touchSession();
    startPage();
  },
  event(name) {
    if (!cfg || !name || name.startsWith("page_view_")) return;
    const cur = pages[pages.length - 1];
    if (cur && cur.ev.size < LIMITS.events) cur.ev.add(name.slice(0, LIMITS.name));
  },
  collect,
  peek() {
    const c = cfg;
    const who = c ? c.identity() : { id: null, email: null, name: null, avatar: null };
    return { capture: c?.capture ?? null, identify: who, page: c?.capture ? readPageIdentity(c.capture, document, who.email) : null };
  },
};

(window as unknown as { __luumuAnalytics?: AnalyticsCollector }).__luumuAnalytics = collector;
