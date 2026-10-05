/*
  Núcleo do Analytics de produto. PURO e testado — usado pelo SDK (o que é enviado), pela
  API (validação) e pelo painel (canais, frequência, formatos, visões salvas).

  O que o SDK manda (um envio por carregamento de página, com as telas visitadas nele):
   - aid: usuário anônimo persistente (localStorage do navegador);
   - uid: o ID do usuário logado, quando o produto chama Luumu.identify;
   - sid + dados de início da sessão (30 min sem atividade = nova sessão): referência
     externa, UTMs e página de entrada — é daí que sai o CANAL de aquisição;
   - por tela: rota normalizada, tempo ativo e os eventos que aconteceram nela.
*/
import { isJunkAvatar, stripNameNoise } from "./identity-filter";

import { fold } from "../search/core";

export const ANALYTICS_DEVICES = ["desktop", "tablet", "mobile"] as const;
export type AnalyticsDevice = (typeof ANALYTICS_DEVICES)[number];

/** Evento interno emitido pelo SDK quando o usuário responde uma pesquisa. */
export const SURVEY_EVENT = "luumu_survey_response";
/** Sessão termina após 30 min sem atividade. */
export const SESSION_IDLE_MS = 30 * 60 * 1000;

export const LIMITS = { pages: 25, events: 40, path: 200, name: 64, id: 64, utm: 100, ref: 253 };

export interface PageHit {
  /** ID da tela (gerado no navegador): continuações somam na mesma tela */
  id: string;
  /** true = continuação de uma tela já enviada (a aba voltou), não é visualização nova */
  c?: boolean;
  path: string;
  /** início da tela (ms desde epoch, relógio do navegador) */
  t: number;
  dur: number;
  ev: string[];
}

/** URL de avatar aceita: https, sem espaços/aspas e curta o bastante (data: e http: ficam de fora). */
export function avatarUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const u = v.trim();
  return u.length <= 500 && /^https:\/\/[a-z0-9.-]+(:\d+)?\/[^\s"'<>\\]*$/i.test(u) ? u : null;
}

export interface AnalyticsPayload {
  key: string;
  host: string;
  aid: string;
  uid: string | null;
  /** e-mail e nome informados em Luumu.identify (para a aba Usuários) */
  email: string | null;
  name: string | null;
  /** foto do usuário na plataforma do cliente (só https; a imagem é carregada direto de lá) */
  avatar: string | null;
  sid: string;
  /** início da sessão (ms) */
  st: number;
  device: AnalyticsDevice;
  os: string;
  browser: string;
  vw: number;
  ref: string;
  utm: { source: string; medium: string; campaign: string };
  landing: string;
  pages: PageHit[];
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const int = (v: unknown, min: number, max: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};
const ID = /^[A-Za-z0-9_-]{6,64}$/;
const NAME = /^[a-z0-9_:.-]{1,64}$/;

/** Valida um envio do SDK (entrada não confiável): limites, formatos e listas cortadas. */
export function parseAnalytics(raw: unknown, now = Date.now()): AnalyticsPayload | null {
  const o = (raw ?? {}) as Record<string, unknown>;
  const aid = str(o.aid, LIMITS.id);
  const sid = str(o.sid, LIMITS.id);
  if (typeof o.key !== "string" || !ID.test(aid) || !ID.test(sid)) return null;
  // relógio do navegador pode estar errado: aceita até 1 dia no passado/futuro, senão usa agora
  const clamp = (t: unknown) => {
    const n = Number(t);
    return Number.isFinite(n) && Math.abs(n - now) < 86_400_000 ? n : now;
  };
  const pages: PageHit[] = [];
  for (const p of Array.isArray(o.pages) ? o.pages.slice(0, LIMITS.pages) : []) {
    const r = (p ?? {}) as Record<string, unknown>;
    const path = str(r.path, LIMITS.path);
    if (!path) continue;
    const ev = Array.from(new Set((Array.isArray(r.ev) ? r.ev : []).filter((e): e is string => typeof e === "string" && NAME.test(e)))).slice(0, LIMITS.events);
    const id = typeof r.id === "string" && /^[A-Za-z0-9]{4,32}$/.test(r.id) ? r.id : Math.random().toString(36).slice(2, 12);
    pages.push({ id, ...(r.c ? { c: true } : {}), path, t: clamp(r.t), dur: int(r.dur, 0, 4 * 60 * 60 * 1000), ev });
  }
  if (!pages.length) return null;
  const utm = (o.utm ?? {}) as Record<string, unknown>;
  return {
    key: o.key,
    host: str(o.host, 253).toLowerCase(),
    aid,
    uid: str(o.uid, 128) || null,
    email: /^[^\s@<>]{1,64}@[^\s@<>]{1,190}\.[a-z]{2,24}$/i.test(str(o.email, 254)) ? str(o.email, 254).toLowerCase() : null,
    name: stripNameNoise(str(o.name, 80).replace(/[<>]/g, "")) || null,
    // ilustração/ícone (SVG, /icons/, personagem) não é foto de gente: nem grava
    avatar: ((a) => (a && !isJunkAvatar(a) ? a : null))(avatarUrl(o.avatar)),
    sid,
    st: clamp(o.st),
    device: ANALYTICS_DEVICES.includes(o.device as AnalyticsDevice) ? (o.device as AnalyticsDevice) : "desktop",
    os: str(o.os, 24) || "Outro",
    browser: str(o.browser, 24) || "Outro",
    vw: int(o.vw, 0, 10_000),
    ref: str(o.ref, LIMITS.ref).toLowerCase(),
    utm: { source: str(utm.source, LIMITS.utm).toLowerCase(), medium: str(utm.medium, LIMITS.utm).toLowerCase(), campaign: str(utm.campaign, LIMITS.utm) },
    landing: str(o.landing, LIMITS.path) || pages[0].path,
    pages,
  };
}

/* ---------- canais de aquisição ---------- */

export const CHANNELS = ["organic", "direct", "social", "email", "ads", "referral", "other"] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_LABEL: Record<Channel, string> = {
  organic: "Orgânico",
  direct: "Direto",
  social: "Social",
  email: "E-mail",
  ads: "Ads",
  referral: "Outros sites",
  other: "Outros",
};

export const CHANNEL_COLOR: Record<Channel, string> = {
  organic: "#6B2BD9",
  direct: "#C084FC",
  social: "#3B82F6",
  email: "#10B981",
  ads: "#F59E0B",
  referral: "#EC4899",
  other: "#94A3B8",
};

const SEARCH = /(^|\.)(google|bing|yahoo|duckduckgo|ecosia|yandex|baidu|brave|startpage|qwant)\./;
const SOCIAL = /(^|\.)(facebook|fb|instagram|t\.co|twitter|x\.com|linkedin|lnkd\.in|youtube|youtu\.be|tiktok|whatsapp|wa\.me|pinterest|reddit|threads|telegram|t\.me|discord|kwai)(\.|$)/;
const EMAIL_HOSTS = /(^|\.)(mail\.google|outlook\.live|mail\.yahoo|webmail)/;

/**
 * Canal de uma sessão, pela ordem: UTM (o que a campanha declarou) → domínio de referência →
 * sem referência = direto. Referência do próprio site (outra aba, login) também é direto.
 */
export function classifyChannel(input: { ref: string; host: string; utmSource: string; utmMedium: string }): Channel {
  const m = fold(input.utmMedium);
  const s = fold(input.utmSource);
  if (m || s) {
    if (/(^|[^a-z])(cpc|ppc|paid|ads?|display|cpm|banner|paidsocial|paid_social|retargeting)([^a-z]|$)/.test(m) || /ads$/.test(s)) return "ads";
    if (/e-?mail|newsletter/.test(m) || /e-?mail|newsletter|mailchimp|rdstation|sendgrid/.test(s)) return "email";
    if (/social/.test(m) || SOCIAL.test(s + ".")) return "social";
    if (/organic|seo/.test(m) || SEARCH.test(s + ".")) return "organic";
    if (/referral/.test(m)) return "referral";
    return "other";
  }
  const ref = input.ref.replace(/^www\./, "");
  const host = input.host.replace(/^www\./, "");
  if (!ref || ref === host || ref.endsWith(`.${host}`) || host.endsWith(`.${ref}`)) return "direct";
  if (SEARCH.test(ref + ".")) return "organic";
  if (SOCIAL.test(ref + ".")) return "social";
  if (EMAIL_HOSTS.test(ref)) return "email";
  return "referral";
}

/* ---------- sistema e navegador ---------- */

export function detectOS(ua: string): string {
  if (/Windows/i.test(ua)) return "Windows";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Mac OS X|Macintosh/i.test(ua)) return "macOS";
  if (/Android/i.test(ua)) return "Android";
  if (/CrOS/i.test(ua)) return "ChromeOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Outro";
}

export function detectBrowser(ua: string): string {
  if (/Edg\//i.test(ua)) return "Edge";
  if (/OPR\/|Opera/i.test(ua)) return "Opera";
  if (/SamsungBrowser/i.test(ua)) return "Samsung Internet";
  if (/Firefox|FxiOS/i.test(ua)) return "Firefox";
  if (/Chrome|CriOS/i.test(ua)) return "Chrome";
  if (/Safari/i.test(ua)) return "Safari";
  return "Outro";
}

/* ---------- frequência de uso ---------- */

export type Frequency = "daily" | "weekly" | "monthly" | "sporadic";
export const FREQUENCY_LABEL: Record<Frequency, string> = { daily: "Diário", weekly: "Semanal", monthly: "Mensal", sporadic: "Esporádico" };

/**
 * Classe de frequência pelo nº de dias distintos com uso no período:
 * ≥ 4 dias/semana = diário; ≥ 1 dia/semana = semanal; mais de 1 dia = mensal; 1 dia = esporádico.
 */
export function frequencyOf(activeDays: number, periodDays: number): Frequency {
  const weeks = Math.max(1, periodDays / 7);
  const perWeek = activeDays / weeks;
  if (perWeek >= 4) return "daily";
  if (perWeek >= 1) return "weekly";
  if (activeDays > 1) return "monthly";
  return "sporadic";
}

/* ---------- formatos ---------- */

export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

export const fmtInt = (n: number) => Math.round(n).toLocaleString("pt-BR");
export const fmtPct = (r: number) => `${Math.round(r * 100)}%`;
export const fmtDec = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

/** Nome legível de um evento automático ("click_salvar" → "Clique: salvar"). */
export function eventLabel(name: string): string {
  if (name === SURVEY_EVENT) return "Respondeu uma pesquisa";
  if (name === "rage_click") return "Clique de frustração";
  if (name === "form_submit") return "Envio de formulário";
  const m = /^(click|link|form_submit|engaged)_(.+)$/.exec(name);
  if (m) {
    const what = m[2].replace(/_/g, " ");
    if (m[1] === "click") return `Clique: ${what}`;
    if (m[1] === "link") return `Link: ${what}`;
    if (m[1] === "form_submit") return `Formulário: ${what}`;
    if (m[1] === "engaged") return `Engajou ${what}`;
  }
  return name.replace(/_/g, " ");
}

/* ---------- visões ---------- */

export const TABS = ["overview", "acquisition", "engagement", "retention", "users", "pages", "devices", "events", "custom"] as const;
export type AnalyticsTab = (typeof TABS)[number];

export const TAB_META: Record<AnalyticsTab, { label: string; title: string; subtitle: string }> = {
  overview: { label: "Visão geral", title: "Visão geral", subtitle: "Acompanhe os principais indicadores de produto e o comportamento dos seus usuários." },
  acquisition: { label: "Aquisição", title: "Aquisição", subtitle: "Entenda como os usuários chegam à sua plataforma e quais canais geram mais valor." },
  engagement: { label: "Engajamento", title: "Engajamento", subtitle: "Acompanhe como os usuários interagem com seu produto e identifique o que gera mais valor." },
  retention: { label: "Retenção", title: "Retenção", subtitle: "Veja quantos usuários voltam e quando eles deixam de voltar." },
  users: { label: "Usuários", title: "Usuários", subtitle: "Quem são as pessoas por trás dos números: o que cada uma fez, de onde veio e como responde." },
  pages: { label: "Páginas", title: "Páginas", subtitle: "As telas mais vistas, por onde as pessoas entram e por onde saem." },
  devices: { label: "Dispositivos", title: "Dispositivos", subtitle: "Em quais aparelhos, sistemas e navegadores o seu produto é usado." },
  events: { label: "Eventos", title: "Eventos", subtitle: "As ações que os usuários realizam no produto, com alcance e tendência." },
  custom: { label: "Personalizada", title: "Visão personalizada", subtitle: "Monte a sua visão com os blocos que importam para o seu objetivo." },
};

/** Blocos disponíveis para a visão personalizada (id → nome e de qual consulta dependem). */
export const WIDGETS = {
  kpi_dau: "Usuários ativos diários (DAU)",
  kpi_mau: "Usuários ativos mensais (MAU)",
  kpi_new_users: "Novos usuários",
  kpi_session_time: "Tempo médio de uso",
  kpi_sessions_per_user: "Sessões por usuário",
  kpi_stickiness: "Aderência (DAU/MAU)",
  kpi_north_star: "North Star",
  kpi_task_success: "Task Success",
  kpi_activation: "Taxa de ativação",
  kpi_survey_conversion: "Conversão para pesquisa",
  kpi_pages_per_session: "Páginas por sessão",
  kpi_recurrent: "Usuários recorrentes (30 dias)",
  kpi_d1: "Retenção D1",
  kpi_d7: "Retenção D7",
  kpi_d30: "Retenção D30",
  users_trend: "Evolução de usuários (DAU/MAU)",
  engagement_funnel: "Funil de engajamento",
  top_pages: "Páginas mais visitadas",
  devices: "Dispositivos mais utilizados",
  session_time: "Tempo médio de sessão",
  retention: "Retenção de usuários (cohorts)",
  retention_curve: "Curva de retenção",
  top_events: "Eventos e ações mais realizadas",
  channels_trend: "Novos usuários por canal",
  channels_donut: "Distribuição de novos usuários",
  channels_table: "Canais de aquisição",
  entry_pages: "Páginas de entrada",
  exit_pages: "Páginas de saída",
  acquisition_funnel: "Conversão no funil de aquisição",
  campaigns: "Novos usuários por campanha",
  engagement_trend: "Evolução do engajamento",
  frequency: "Usuários por frequência de uso",
  features: "Funcionalidades mais utilizadas",
  hours: "Horários de maior engajamento",
  device_time: "Tempo de sessão por dispositivo",
  os: "Sistemas operacionais",
  browsers: "Navegadores",
  viewports: "Tamanhos de tela",
  device_trend: "Usuários por dispositivo ao longo do tempo",
  events_trend: "Tendência dos principais eventos"
} as const;
export type WidgetId = keyof typeof WIDGETS;
export const WIDGET_IDS = Object.keys(WIDGETS) as WidgetId[];

export interface ViewConfig {
  tab: AnalyticsTab;
  period?: string;
  from?: string;
  to?: string;
  host?: string;
  device?: string;
  widgets?: WidgetId[];
  /** largura de cada bloco (colunas de 12) na visão personalizada; ausente = tamanho padrão */
  spans?: Partial<Record<WidgetId, number>>;
}

/** Largura aceita para um bloco: inteiro de 2 a 12 colunas. */
export const clampSpan = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? Math.min(12, Math.max(2, Math.round(n))) : undefined);

/** Limpa a configuração de uma visão salva (vem do banco/usuário). */
export function parseViewConfig(raw: unknown): ViewConfig {
  const o = (raw ?? {}) as Record<string, unknown>;
  const tab = TABS.includes(o.tab as AnalyticsTab) ? (o.tab as AnalyticsTab) : "overview";
  const s = (v: unknown, re: RegExp) => (typeof v === "string" && re.test(v) ? v : undefined);
  // blocos: "id" ou "id:colunas" (formato da URL), sem repetição, até 30
  const spans: Partial<Record<WidgetId, number>> = {};
  if (o.spans && typeof o.spans === "object") {
    for (const [k, v] of Object.entries(o.spans as Record<string, unknown>)) if (WIDGET_IDS.includes(k as WidgetId) && clampSpan(v)) spans[k as WidgetId] = clampSpan(v);
  }
  const widgets = Array.isArray(o.widgets)
    ? ([
        ...new Set(
          o.widgets
            .map((w) => {
              if (typeof w !== "string") return null;
              const [id, span] = w.split(":");
              if (!WIDGET_IDS.includes(id as WidgetId)) return null;
              if (span && clampSpan(Number(span))) spans[id as WidgetId] = clampSpan(Number(span));
              return id as WidgetId;
            })
            .filter((w): w is WidgetId => !!w)
        ),
      ].slice(0, 30) as WidgetId[])
    : undefined;
  for (const k of Object.keys(spans) as WidgetId[]) if (!widgets?.includes(k)) delete spans[k];
  return {
    tab,
    period: s(o.period, /^(today|7d|30d|90d|12m|all|custom)$/),
    from: s(o.from, /^\d{4}-\d{2}-\d{2}$/),
    to: s(o.to, /^\d{4}-\d{2}-\d{2}$/),
    host: s(o.host, /^[a-z0-9.-]{1,253}$/),
    device: s(o.device, /^(desktop|tablet|mobile)$/),
    widgets: tab === "custom" ? widgets ?? [] : undefined,
    spans: tab === "custom" && Object.keys(spans).length ? spans : undefined,
  };
}

/** URL da página de Analytics para uma configuração (e, opcionalmente, uma visão salva). */
export function viewHref(c: ViewConfig, viewId?: string): string {
  const p = new URLSearchParams();
  if (viewId) p.set("view", viewId);
  if (c.tab !== "overview") p.set("tab", c.tab);
  for (const k of ["period", "from", "to", "host", "device"] as const) if (c[k]) p.set(k, c[k]!);
  if (c.tab === "custom" && c.widgets?.length) p.set("w", c.widgets.map((w) => (c.spans?.[w] ? `${w}:${c.spans[w]}` : w)).join(","));
  const q = p.toString();
  return `/analytics${q ? `?${q}` : ""}`;
}

/** Variação percentual (null sem base). */
export function pctChange(cur: number, prev: number | null | undefined): number | null {
  if (!prev) return null;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}
