/**
 * Luumu Tour Runtime — carregado sob demanda pelo core (sdk/luumu.ts) só quando há tour
 * elegível, preview, ou chamada a Luumu.tours.*. Compilado para /public/sdk-tours.js.
 *
 * Regras de ouro (docs/tours/ARQUITETURA.md §4):
 *  - nunca quebrar a aplicação do cliente: toda entrada pública é envolvida em `safe()`;
 *  - nunca alterar elementos do cliente: destaque e card são desenhados numa camada própria
 *    (Shadow DOM), por cima;
 *  - nunca executar código vindo da configuração: ações são whitelist.
 */
import { canShow } from "../../lib/tours/frequency";
import { matchesAudience, evaluateRules, type ConditionContext } from "../../lib/tours/conditions";
import { computePosition, isInViewport } from "../../lib/tours/position";
import { cardWidth, renderCard, tourCss } from "../../lib/tours/render";
import { routeMatches } from "../../lib/tours/target";
import { deviceConfig, deviceForWidth, normalizeSettings, normalizeSteps } from "../../lib/tours/normalize";
import type { TourCatalogEntry, TourEventInput, TourEventType, TourPayload, TourStep } from "../../lib/tours/types";
import { LUUMU_HOST_ATTR, waitForElement } from "../shared/dom";
import { launchConfetti } from "../../lib/tours/confetti";
import {
  anonymousId,
  clearActive,
  clearSession,
  isFirstSession,
  isNewUser,
  markShownThisSession,
  newRunId,
  readActive,
  readMemory,
  shownThisSession,
  writeActive,
  writeMemory,
} from "../shared/memory";

export interface RuntimeContext {
  api: string;
  key: string;
  host: string;
  identity: () => Record<string, unknown>;
  track: (name: string) => void;
  catalog: TourCatalogEntry[];
  previewToken?: string | null;
}

interface Running {
  tour: TourPayload;
  steps: TourStep[];
  index: number;
  run: string;
  preview: boolean;
  shownAt: number;
  el: Element | null;
}

const PREVIEW_KEY = "luumu_preview_token";

function safe<T>(fn: () => T, fallback?: T): T | undefined {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

let ctx: RuntimeContext | null = null;
let cur: Running | null = null;
let seq = 0; // invalida exibições em andamento quando outra começa
let host: HTMLElement | null = null;
let root: ShadowRoot | null = null;
let layer: HTMLDivElement | null = null;
let prevFocus: Element | null = null;
let raf = 0;
let cleanupStep: (() => void) | null = null;
let routeTimer: ReturnType<typeof setInterval> | null = null;
let lastPath = "";
const pendingTriggers: TourCatalogEntry[] = [];

/* ------------------------------------------------------------------ eventos */

const queue: TourEventInput[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function emit(type: TourEventType, stepKey?: string | null, meta?: TourEventInput["meta"]) {
  if (!ctx || !cur || cur.preview) return; // preview não conta no analytics
  const id = ctx.identity();
  queue.push({
    type,
    tourId: cur.tour.id,
    versionId: cur.tour.versionId,
    stepKey: stepKey ?? null,
    userId: typeof id.id === "string" ? id.id : null,
    anonymousId: anonymousId(),
    sessionId: cur.run,
    route: location.pathname,
    ts: Date.now(),
    meta,
  });
  if (queue.length >= 20) flush();
  else if (!flushTimer) flushTimer = setTimeout(() => flush(), 3000);
}

function flush(beacon = false) {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (!ctx || !queue.length) return;
  const body = JSON.stringify({ key: ctx.key, events: queue.splice(0, 50) });
  const url = `${ctx.api}/tours/events`;
  safe(() => {
    if (beacon && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: "text/plain;charset=UTF-8" }));
      return;
    }
    fetch(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8" }, body, keepalive: true }).catch(() => {});
  });
}

/* ------------------------------------------------------------------ dados */

async function fetchTour(id: string, v: number | null, preview: boolean): Promise<TourPayload | null> {
  if (!ctx) return null;
  try {
    const url = preview
      ? `${ctx.api}/tours/preview?token=${encodeURIComponent(ctx.previewToken || "")}&key=${encodeURIComponent(ctx.key)}`
      : `${ctx.api}/tours/${encodeURIComponent(id)}?key=${encodeURIComponent(ctx.key)}${v != null ? `&v=${v}` : ""}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const d = (await r.json()) as TourPayload & { startAt?: string | null };
    // o que vem da rede passa pela mesma whitelist do servidor antes de virar HTML
    return { ...d, settings: normalizeSettings(d.settings), steps: normalizeSteps(d.steps) };
  } catch {
    return null;
  }
}

function conditionContext(): ConditionContext {
  return {
    user: ctx ? ctx.identity() : {},
    route: location.pathname,
    host: ctx?.host || location.hostname,
    isNewUser: isNewUser(),
  };
}

const userKey = () => {
  const id = ctx?.identity().id;
  return typeof id === "string" ? id : undefined;
};

/* ------------------------------------------------------------------ camada visual */

function ensureLayer(): HTMLDivElement {
  if (layer && host?.isConnected) return layer;
  host = document.createElement("div");
  host.setAttribute(LUUMU_HOST_ATTR, "tour");
  host.style.cssText = "position:fixed;inset:0;z-index:2147483000;pointer-events:none;";
  root = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = cur ? tourCss(cur.tour.settings.appearance) : "";
  root.appendChild(style);
  layer = document.createElement("div");
  layer.className = "lt-root";
  layer.setAttribute("aria-live", "polite");
  root.appendChild(layer);
  document.body.appendChild(host);
  return layer;
}

function teardownLayer() {
  cancelAnimationFrame(raf);
  cleanupStep?.();
  cleanupStep = null;
  host?.remove();
  host = root = layer = null;
}

/** Desenha o passo atual: backdrop/spotlight/anel + card, e mantém posicionado. */
function paint(step: TourStep, el: Element | null) {
  if (!cur) return;
  const lay = ensureLayer();
  const style = root!.querySelector("style")!;
  style.textContent = tourCss(cur.tour.settings.appearance);

  const visible = cur.steps;
  const vw = window.innerWidth;
  const device = deviceForWidth(vw);
  const cfg = deviceConfig(step, device);
  const isModal = step.type === "modal" || !el || cfg.placement === "center";
  const width = cardWidth(step.type, device === "mobile" && cfg.width == null && !isModal ? vw - 32 : cfg.width, vw);
  const spotlight = !isModal && (step.type === "spotlight" || step.highlight === "spotlight");
  const ring = !isModal && !spotlight && step.highlight === "ring";

  lay.innerHTML =
    (isModal ? '<div class="lt-backdrop"></div>' : "") +
    (spotlight ? '<div class="lt-hole"></div>' : "") +
    (ring ? '<div class="lt-ring"></div>' : "") +
    renderCard(step, {
      index: cur.index,
      total: visible.length,
      appearance: cur.tour.settings.appearance,
      side: isModal ? "center" : "bottom",
      arrow: null,
      width,
    });

  const card = lay.querySelector(".lt-card") as HTMLElement;
  const hole = lay.querySelector(".lt-hole") as HTMLElement | null;
  const ringEl = lay.querySelector(".lt-ring") as HTMLElement | null;

  const place = () => {
    raf = 0;
    if (!card.isConnected) return;
    const vp = { width: window.innerWidth, height: window.innerHeight };
    const size = { width: card.offsetWidth, height: card.offsetHeight };
    const rect = el && !isModal ? el.getBoundingClientRect() : null;
    const anchor = rect ? { x: rect.left, y: rect.top, width: rect.width, height: rect.height } : null;
    const pos = computePosition(anchor, size, vp, isModal ? "center" : cfg.placement, { offset: 14, margin: 12 });
    card.style.left = `${pos.x}px`;
    card.style.top = `${pos.y}px`;
    card.style.position = "fixed";
    // seta: recria só se o lado mudou
    const arrow = card.querySelector(".lt-arrow") as HTMLElement | null;
    if (!isModal && pos.side !== "center" && pos.arrow !== null) {
      const a = arrow || card.insertBefore(document.createElement("div"), card.firstChild);
      a.className = `lt-arrow lt-${pos.side}`;
      a.setAttribute("style", pos.side === "top" || pos.side === "bottom" ? `left:${pos.arrow - 7}px` : `top:${pos.arrow - 7}px`);
    } else arrow?.remove();
    if (anchor) {
      const pad = 6;
      for (const box of [hole, ringEl]) {
        if (!box) continue;
        box.style.left = `${anchor.x - pad}px`;
        box.style.top = `${anchor.y - pad}px`;
        box.style.width = `${anchor.width + pad * 2}px`;
        box.style.height = `${anchor.height + pad * 2}px`;
      }
    }
  };
  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(place);
  };
  place();

  // ações dos botões (delegação: o card é recriado a cada passo)
  const onClick = (e: Event) => {
    const t = (e.target as Element).closest("[data-lt]");
    if (!t) return;
    const action = t.getAttribute("data-lt");
    safe(() => {
      if (action === "next") next();
      else if (action === "back") previous();
      else if (action === "close") dismiss("close");
      else if (action === "skip") dismiss("skip");
      else if (action === "never") dismiss("never");
    });
  };
  card.addEventListener("click", onClick);

  // teclado: ESC dispensa (se permitido), setas navegam quando o foco está no card
  const onKey = (e: KeyboardEvent) => {
    if (!cur) return;
    if (e.key === "Escape" && cur.tour.settings.appearance.allowDismiss) {
      e.stopPropagation();
      dismiss("escape");
    } else if (root?.activeElement && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
      if (e.key === "ArrowRight") next();
      else previous();
    }
  };
  window.addEventListener("keydown", onKey, true);

  // avanço por clique no próprio elemento
  const onTargetClick = () => safe(() => next());
  if (el && step.advance === "click_target") el.addEventListener("click", onTargetClick, { once: true });

  window.addEventListener("scroll", schedule, true);
  window.addEventListener("resize", schedule);
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
  ro?.observe(card);
  if (el) ro?.observe(el);

  cleanupStep = () => {
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("scroll", schedule, true);
    window.removeEventListener("resize", schedule);
    el?.removeEventListener("click", onTargetClick);
    ro?.disconnect();
  };

  // foco no card para leitores de tela e teclado (sem rolar a página)
  safe(() => (card as HTMLElement).focus({ preventScroll: true }));
}

/* ------------------------------------------------------------------ navegação */

/**
 * Leva o usuário à rota do passo. Primeiro tenta um link da própria aplicação para a rota —
 * o router do cliente (React, Vue, Angular...) cuida da navegação SPA sem recarregar. Sem
 * link, `location.assign`: a página recarrega e o tour retoma do sessionStorage.
 */
function navigate(route: string) {
  const link = Array.from(document.querySelectorAll("a[href]")).find((a) => {
    try {
      return new URL((a as HTMLAnchorElement).href, location.href).pathname === route && (a as HTMLAnchorElement).origin === location.origin;
    } catch {
      return false;
    }
  }) as HTMLAnchorElement | undefined;
  if (link) link.click();
  else location.assign(route);
}

function waitForRoute(route: string, timeoutMs: number, token: number): Promise<boolean> {
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      if (token !== seq) return resolve(false);
      if (routeMatches(route, location.pathname)) return resolve(true);
      if (Date.now() - started > timeoutMs) return resolve(false);
      setTimeout(tick, 120);
    };
    tick();
  });
}

/* ------------------------------------------------------------------ fluxo */

function persist() {
  if (!cur) return;
  writeActive({ id: cur.tour.id, v: cur.tour.v, index: cur.index, run: cur.run, preview: cur.preview, startedAt: Date.now() });
}

async function show(index: number, dir: 1 | -1 = 1): Promise<void> {
  if (!cur) return;
  const token = ++seq;
  cleanupStep?.();
  cleanupStep = null;
  if (index < 0) index = 0;
  if (index >= cur.steps.length) return complete();
  cur.index = index;
  persist();
  const step = cur.steps[index];

  // condições do passo (rota, plano, cargo...): não satisfeitas = passo pulado em silêncio
  if (!evaluateRules(step.conditions, conditionContext())) {
    emit("tour_step_skipped", step.key, { reason: "condition" });
    return show(index + dir, dir);
  }

  if (step.route && !routeMatches(step.route, location.pathname)) {
    if (layer) layer.innerHTML = ""; // nada pendurado durante a troca de página
    if (!step.route.includes(":") && !step.route.includes("*")) navigate(step.route);
    const arrived = await waitForRoute(step.route, step.waitTimeoutMs, token);
    if (token !== seq || !cur) return;
    if (!arrived) return missing(step, index, dir, "route");
  }

  let el: Element | null = null;
  if (step.type !== "modal" && step.target) {
    const signal = { cancelled: false };
    el = await waitForElement(step.target, step.waitTimeoutMs, signal);
    if (token !== seq || !cur) return;
    if (!el) return missing(step, index, dir, "element");
    if (step.scroll.enabled) {
      const r = el.getBoundingClientRect();
      if (!isInViewport({ x: r.left, y: r.top, width: r.width, height: r.height }, { width: innerWidth, height: innerHeight }, -40)) {
        el.scrollIntoView({ behavior: step.scroll.behavior === "smooth" ? "smooth" : "auto", block: step.scroll.block, inline: "nearest" });
        await new Promise((r) => setTimeout(r, step.scroll.behavior === "smooth" ? 380 : 30));
        if (token !== seq || !cur) return;
      }
    }
  }

  cur.el = el;
  cur.shownAt = Date.now();
  if (!prevFocus) prevFocus = document.activeElement;
  paint(step, el);
  emit("tour_step_viewed", step.key);
}

function missing(step: TourStep, index: number, dir: 1 | -1, what: "route" | "element") {
  emit("tour_target_not_found", step.key, { what });
  if (step.onMissing === "end") {
    emit("tour_error", step.key, { reason: `${what}_not_found` });
    return finish();
  }
  return show(index + dir, dir);
}

function runAction(step: TourStep) {
  const a = step.action;
  if (a.type === "navigate" && a.value) navigate(a.value);
  else if (a.type === "open_url" && a.value && /^https?:\/\//i.test(a.value)) {
    window.open(a.value, a.newTab ? "_blank" : "_self", "noopener");
  } else if (a.type === "track" && a.value) ctx?.track(a.value);
}

function next() {
  if (!cur) return;
  const step = cur.steps[cur.index];
  emit("tour_step_completed", step?.key, { durationMs: Date.now() - cur.shownAt });
  if (step) safe(() => runAction(step));
  void show(cur.index + 1, 1);
}

function previous() {
  if (!cur || cur.index === 0) return;
  void show(cur.index - 1, -1);
}

function skipStep() {
  if (!cur) return;
  emit("tour_step_skipped", cur.steps[cur.index]?.key, { reason: "api" });
  void show(cur.index + 1, 1);
}

function celebrate(ap: TourPayload["settings"]["appearance"]) {
  if (!ap.confetti) return;
  // host próprio: a camada do tour é removida no finish(), o confete precisa continuar
  const h = document.createElement("div");
  h.setAttribute(LUUMU_HOST_ATTR, "confetti");
  h.style.cssText = "position:fixed;inset:0;z-index:2147483001;pointer-events:none;";
  document.body.appendChild(h);
  launchConfetti(h.attachShadow({ mode: "open" }), { accent: ap.accent, fixed: true });
  setTimeout(() => h.remove(), 7500); // um pouco além da animação (6,5s)
}

function complete() {
  if (!cur) return;
  safe(() => celebrate(cur!.tour.settings.appearance));
  emit("tour_completed", null, { durationMs: Date.now() - cur.shownAt });
  if (!cur.preview) writeMemory(cur.tour.id, userKey(), { completed: Date.now() });
  finish();
}

function dismiss(reason: "close" | "skip" | "escape" | "never" | "api") {
  if (!cur) return;
  emit("tour_dismissed", cur.steps[cur.index]?.key, { reason });
  if (!cur.preview) {
    writeMemory(cur.tour.id, userKey(), reason === "never" ? { dismissed: Date.now(), never: Date.now() } : { dismissed: Date.now() });
  }
  finish();
}

function finish() {
  seq++;
  if (cur?.preview) clearSession(PREVIEW_KEY);
  cur = null;
  clearActive();
  teardownLayer();
  flush();
  safe(() => (prevFocus as HTMLElement | null)?.focus?.({ preventScroll: true }));
  prevFocus = null;
  // um tour por vez: o próximo gatilho pendente pode rodar agora
  setTimeout(() => safe(evaluateTriggers), 400);
}

async function start(
  id: string,
  opts: { preview?: boolean; v?: number | null; atIndex?: number; atKey?: string | null; run?: string; resumed?: boolean } = {}
) {
  if (!ctx) return;
  if (cur) finish();
  const payload = await fetchTour(id, opts.v ?? null, !!opts.preview);
  if (!payload) return;
  const steps = payload.steps.filter((s) => s.enabled);
  if (!steps.length) return;
  let index = opts.atIndex ?? 0;
  // o passo inicial do link de preview só vale na primeira abertura; ao retomar, vale o índice salvo
  const startKey = opts.atKey ?? (opts.atIndex === undefined ? (payload as { startAt?: string | null }).startAt : null);
  if (startKey) index = Math.max(0, steps.findIndex((s) => s.key === startKey));
  index = Math.min(index, steps.length - 1);
  cur = { tour: payload, steps, index, run: opts.run || newRunId(), preview: !!opts.preview, shownAt: Date.now(), el: null };
  if (!opts.resumed) {
    if (!cur.preview) {
      writeMemory(id, userKey(), { started: Date.now() });
      markShownThisSession(id);
    }
    emit("tour_started");
  }
  emit("tour_viewed");
  await show(index);
}

/* ------------------------------------------------------------------ gatilhos */

function eligible(t: TourCatalogEntry): boolean {
  if (!canShow(t.frequency, readMemory(t.id, userKey()), shownThisSession(t.id))) return false;
  return matchesAudience(t.audience, conditionContext());
}

/** Gatilhos de carregamento/primeiro acesso: avaliados no boot e a cada troca de rota. */
function evaluateTriggers() {
  if (!ctx || cur) return;
  for (const t of pendingTriggers.slice()) {
    if (t.trigger.type !== "first_access" && t.trigger.type !== "page_load") continue;
    if (t.trigger.type === "first_access" && !isFirstSession()) continue;
    if (t.trigger.route && !routeMatches(t.trigger.route, location.pathname)) continue;
    if (!eligible(t)) continue;
    pendingTriggers.splice(pendingTriggers.indexOf(t), 1);
    setTimeout(() => safe(() => void start(t.id, { v: t.v })), Math.max(0, t.trigger.delaySec * 1000));
    return;
  }
}

function watchRoute() {
  if (routeTimer) return;
  lastPath = location.pathname;
  const check = () =>
    safe(() => {
      if (location.pathname === lastPath) return;
      lastPath = location.pathname;
      if (cur) {
        // o usuário saiu da rota do passo por conta própria: reposiciona/espera de novo
        const step = cur.steps[cur.index];
        if (step?.route && !routeMatches(step.route, location.pathname)) void show(cur.index);
        else if (step && cur.el && !cur.el.isConnected) void show(cur.index);
      } else evaluateTriggers();
    });
  routeTimer = setInterval(check, 400);
  window.addEventListener("popstate", check);
}

/* ------------------------------------------------------------------ API */

const runtime = {
  boot(c: RuntimeContext) {
    safe(() => {
      ctx = c;
      pendingTriggers.splice(0, pendingTriggers.length, ...c.catalog);
      window.addEventListener("pagehide", () => flush(true));
      document.addEventListener("visibilitychange", () => document.hidden && flush(true));
      watchRoute();

      // preview vindo do painel tem prioridade sobre tudo
      if (c.previewToken) {
        const active = readActive();
        void start("preview", active?.preview ? { preview: true, atIndex: active.index, run: active.run, resumed: true } : { preview: true });
        return;
      }
      // tour em andamento antes de um reload: retoma no mesmo passo
      const active = readActive();
      if (active && !active.preview && c.catalog.some((t) => t.id === active.id)) {
        void start(active.id, { v: active.v, atIndex: active.index, run: active.run, resumed: true });
        return;
      }
      evaluateTriggers();
    });
  },
  updateCatalog(list: TourCatalogEntry[]) {
    safe(() => {
      if (ctx) ctx.catalog = list;
      pendingTriggers.splice(0, pendingTriggers.length, ...list);
      evaluateTriggers();
    });
  },
  onTrack(name: string) {
    safe(() => {
      if (cur) return;
      const t = pendingTriggers.find((x) => x.trigger.type === "event" && x.trigger.event === name && eligible(x));
      if (t) setTimeout(() => safe(() => void start(t.id, { v: t.v })), Math.max(0, t.trigger.delaySec * 1000));
    });
  },
  start: (id: string) => safe(() => void start(id, { v: ctx?.catalog.find((t) => t.id === id)?.v ?? null })),
  stop: () => safe(() => dismiss("api")),
  next: () => safe(next),
  previous: () => safe(previous),
  skip: () => safe(skipStep),
  complete: () => safe(complete),
  isActive: () => !!cur,
  getCurrentStep: () =>
    cur ? { tourId: cur.tour.id, index: cur.index, total: cur.steps.length, key: cur.steps[cur.index]?.key ?? null } : null,
};

(window as unknown as { __luumuToursRuntime?: typeof runtime }).__luumuToursRuntime = runtime;
export type ToursRuntime = typeof runtime;
