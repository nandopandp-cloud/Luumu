/*
  Validação/whitelist de tudo que descreve um tour. Usada no servidor antes de gravar
  (o que vem do painel e do overlay do builder é entrada do cliente) e no SDK antes de
  renderizar. Nada aqui lança: valores inválidos voltam para o padrão.
*/
import { defaultSettings, defaultStep, DEFAULT_APPEARANCE, newStepKey } from "./defaults";
import {
  BREAKPOINTS,
  PLACEMENTS,
  STEP_TYPES,
  TARGET_STRATEGIES,
  type Device,
  type ElementKind,
  type ElementTarget,
  type Frequency,
  type Placement,
  type Rule,
  type RuleOp,
  type StepAction,
  type StepDeviceConfig,
  type StepType,
  type TourAudience,
  type TourSettings,
  type TourStep,
  type TourTrigger,
} from "./types";

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const str = (v: unknown, max: number, fallback = ""): string =>
  typeof v === "string" ? v.slice(0, max) : fallback;
const optStr = (v: unknown, max: number): string | undefined => {
  const s = typeof v === "string" ? v.trim().slice(0, max) : "";
  return s ? s : undefined;
};
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
const num = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
function oneOf<T extends string>(v: unknown, list: readonly T[], fallback: T): T {
  return typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : fallback;
}

/** Rota relativa do produto ("/projects/:id"); qualquer outra coisa vira null. */
export function normalizeRoute(v: unknown): string | null {
  if (typeof v !== "string") return null;
  let r = v.trim();
  if (!r) return null;
  // aceita URL completa colada pelo usuário: fica só o caminho
  if (/^https?:\/\//i.test(r)) {
    try {
      r = new URL(r).pathname;
    } catch {
      return null;
    }
  }
  if (!r.startsWith("/") || r.startsWith("//")) return null;
  r = r.split("?")[0].split("#")[0];
  if (r.length > 1) r = r.replace(/\/+$/, "");
  return r.slice(0, 300) || "/";
}

/** Só http(s). Bloqueia javascript:, data: etc. */
export function safeUrl(v: unknown): string | undefined {
  if (typeof v !== "string" || !v.trim()) return undefined;
  try {
    const u = new URL(v.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString().slice(0, 1000) : undefined;
  } catch {
    return undefined;
  }
}

/** Nome de evento no mesmo formato do catálogo (normalizeEventName / slug do SDK). */
export function eventSlug(v: unknown): string {
  return typeof v !== "string"
    ? ""
    : v
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9.-]+/g, "_")
        .replace(/_{2,}/g, "_")
        .replace(/^_|_$/g, "")
        .slice(0, 64);
}

const KINDS: readonly ElementKind[] = ["button", "link", "navigation", "input", "select", "tab", "menu", "card", "other"];

export function normalizeTarget(v: unknown): ElementTarget | null {
  const t = obj(v);
  const tag = optStr(t.tag, 32)?.toLowerCase();
  const fingerprint = optStr(t.fingerprint, 64);
  if (!tag || !fingerprint) return null;
  const classes = Array.isArray(t.classes)
    ? t.classes.filter((c): c is string => typeof c === "string").slice(0, 6).map((c) => c.slice(0, 64))
    : undefined;
  return {
    luumuId: optStr(t.luumuId, 120),
    elementId: optStr(t.elementId, 120),
    testId: optStr(t.testId, 120),
    ariaLabel: optStr(t.ariaLabel, 160),
    role: optStr(t.role, 32),
    tag,
    text: optStr(t.text, 120),
    name: optStr(t.name, 120),
    href: optStr(t.href, 300),
    classes: classes && classes.length ? classes : undefined,
    path: optStr(t.path, 300),
    selector: optStr(t.selector, 500),
    fingerprint,
    strategy: oneOf(t.strategy, TARGET_STRATEGIES, "selector"),
    stability: num(t.stability, 0, 1, 0.3),
    label: str(t.label, 120) || optStr(t.text, 120) || tag,
    kind: oneOf(t.kind, KINDS, "other"),
    description: optStr(t.description, 240),
  };
}

const RULE_OPS: readonly RuleOp[] = ["eq", "neq", "contains", "gt", "lt", "exists", "not_exists"];
export function normalizeRules(v: unknown): Rule[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((r): Rule | null => {
      const o = obj(r);
      const field = str(o.field, 80).trim();
      if (!/^(route|host|user\.[a-zA-Z0-9_.-]{1,60})$/.test(field)) return null;
      return { field, op: oneOf(o.op, RULE_OPS, "eq"), value: str(o.value, 200) };
    })
    .filter((r): r is Rule => r !== null)
    .slice(0, 20);
}

function normalizeDeviceConfig(v: unknown): StepDeviceConfig | undefined {
  const o = obj(v);
  if (!Object.keys(o).length) return undefined;
  return {
    placement: o.placement === undefined ? undefined : oneOf(o.placement, PLACEMENTS, "auto"),
    width: o.width === null || o.width === undefined ? null : num(o.width, 200, 640, 360),
  };
}

function normalizeAction(v: unknown): StepAction {
  const o = obj(v);
  const type = oneOf(o.type, ["none", "navigate", "open_url", "track"] as const, "none");
  if (type === "navigate") {
    const route = normalizeRoute(o.value);
    return route ? { type, value: route } : { type: "none" };
  }
  if (type === "open_url") {
    const url = safeUrl(o.value);
    return url ? { type, value: url, newTab: bool(o.newTab, true) } : { type: "none" };
  }
  if (type === "track") {
    const ev = eventSlug(o.value);
    return ev ? { type, value: ev } : { type: "none" };
  }
  return { type: "none" };
}

export function normalizeStep(v: unknown): TourStep {
  const o = obj(v);
  const type: StepType = oneOf(o.type, STEP_TYPES, "tooltip");
  const base = defaultStep(type);
  const buttons = obj(o.buttons);
  const scroll = obj(o.scroll);
  const responsive: TourStep["responsive"] = {};
  const resp = obj(o.responsive);
  for (const d of ["desktop", "tablet", "mobile"] as Device[]) {
    const cfg = normalizeDeviceConfig(resp[d]);
    if (cfg) responsive[d] = cfg;
  }
  const target = type === "modal" ? null : normalizeTarget(o.target);
  return {
    key: /^[a-z0-9_]{4,40}$/i.test(String(o.key ?? "")) ? String(o.key) : newStepKey(),
    type,
    enabled: bool(o.enabled, true),
    title: str(o.title, 120, base.title),
    body: str(o.body, 600, base.body),
    imageUrl: safeUrl(o.imageUrl),
    route: normalizeRoute(o.route),
    target,
    placement: oneOf(o.placement, PLACEMENTS, base.placement),
    responsive,
    buttons: {
      next: str(buttons.next, 30, base.buttons.next) || base.buttons.next,
      back: str(buttons.back, 30, base.buttons.back) || base.buttons.back,
      skip: str(buttons.skip, 30, base.buttons.skip) || base.buttons.skip,
      showBack: bool(buttons.showBack, base.buttons.showBack),
      showSkip: bool(buttons.showSkip, base.buttons.showSkip),
    },
    advance: target ? oneOf(o.advance, ["button", "click_target"] as const, "button") : "button",
    highlight: oneOf(o.highlight, ["none", "ring", "spotlight"] as const, base.highlight),
    scroll: {
      enabled: bool(scroll.enabled, true),
      behavior: oneOf(scroll.behavior, ["smooth", "instant"] as const, "smooth"),
      block: oneOf(scroll.block, ["center", "start", "end", "nearest"] as const, "center"),
    },
    onMissing: oneOf(o.onMissing, ["skip", "end"] as const, "skip"),
    waitTimeoutMs: num(o.waitTimeoutMs, 500, 30000, 6000),
    action: normalizeAction(o.action),
    conditions: normalizeRules(o.conditions),
  };
}

/** Lista de passos: normaliza, garante keys únicas e limita o tamanho do tour. */
export function normalizeSteps(v: unknown): TourStep[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  return v.slice(0, 50).map((raw) => {
    const step = normalizeStep(raw);
    if (seen.has(step.key)) step.key = newStepKey();
    seen.add(step.key);
    return step;
  });
}

function normalizeTrigger(v: unknown): TourTrigger {
  const o = obj(v);
  const type = oneOf(o.type, ["first_access", "page_load", "event", "manual"] as const, "first_access");
  const event = type === "event" ? eventSlug(o.event) || undefined : undefined;
  return {
    type: type === "event" && !event ? "manual" : type,
    event,
    route: normalizeRoute(o.route),
    delaySec: num(o.delaySec, 0, 120, 1),
  };
}

function normalizeAudience(v: unknown): TourAudience {
  const o = obj(v);
  return {
    mode: oneOf(o.mode, ["all", "new", "existing", "rules"] as const, "all"),
    match: oneOf(o.match, ["all", "any"] as const, "all"),
    rules: normalizeRules(o.rules),
  };
}

const HEX = /^#[0-9a-f]{6}$/i;

export function normalizeSettings(v: unknown, normalizeHost: (h: string) => string = (h) => h): TourSettings {
  const o = obj(v);
  const base = defaultSettings();
  const ap = obj(o.appearance);
  const hosts = Array.isArray(o.targetHosts)
    ? Array.from(new Set(o.targetHosts.map((h) => normalizeHost(String(h))).filter(Boolean))).slice(0, 50)
    : [];
  const frequencies: readonly Frequency[] = ["once", "once_per_session", "until_completed", "until_dismissed", "always"];
  return {
    trigger: normalizeTrigger(o.trigger),
    frequency: oneOf(o.frequency, frequencies, base.frequency),
    audience: normalizeAudience(o.audience),
    targetHosts: hosts,
    startUrl: safeUrl(o.startUrl) ?? "",
    appearance: {
      theme: oneOf(ap.theme, ["luumu", "minimal", "dark", "custom"] as const, DEFAULT_APPEARANCE.theme),
      accent: typeof ap.accent === "string" && HEX.test(ap.accent) ? ap.accent : DEFAULT_APPEARANCE.accent,
      progress: oneOf(ap.progress, ["count", "dots", "none"] as const, DEFAULT_APPEARANCE.progress),
      allowDismiss: bool(ap.allowDismiss, DEFAULT_APPEARANCE.allowDismiss),
      dontShowAgain: bool(ap.dontShowAgain, DEFAULT_APPEARANCE.dontShowAgain),
      backdropOpacity: num(ap.backdropOpacity, 0, 0.8, DEFAULT_APPEARANCE.backdropOpacity),
      radius: num(ap.radius, 0, 28, DEFAULT_APPEARANCE.radius),
    },
  };
}

/** Configuração efetiva de um passo num dispositivo (o base + o que o dispositivo sobrescreve). */
export function deviceConfig(step: TourStep, device: Device): { placement: Placement; width: number | null } {
  const own = step.responsive[device] ?? {};
  // tablet herda do desktop quando não tem configuração própria
  const inherited = device === "tablet" ? step.responsive.desktop ?? {} : {};
  return {
    placement: own.placement ?? inherited.placement ?? step.placement,
    width: own.width !== undefined ? own.width : inherited.width ?? null,
  };
}

export function deviceForWidth(width: number): Device {
  if (width < BREAKPOINTS.mobile) return "mobile";
  if (width < BREAKPOINTS.tablet) return "tablet";
  return "desktop";
}
