/*
  Do dado bruto (lib/db/analytics.ts) ao que a tela mostra: KPIs com comparação, séries,
  composições das abas e quais consultas cada bloco exige. PURO e testado.
*/
import { CHANNELS, pctChange, type AnalyticsTab, type Channel, type WidgetId } from "./core";
import type { AnalyticsData, Dataset } from "@/lib/db/analytics";

/* ---------- composição das abas ---------- */

export interface Block {
  id: WidgetId;
  /** colunas (de 12) em telas largas */
  span: number;
}

const b = (id: WidgetId, span: number): Block => ({ id, span });

export const TAB_LAYOUT: Record<Exclude<AnalyticsTab, "custom">, Block[]> = {
  overview: [
    b("kpi_dau", 2), b("kpi_mau", 2), b("kpi_north_star", 2), b("kpi_task_success", 2), b("kpi_session_time", 2), b("kpi_stickiness", 2),
    b("users_trend", 8), b("engagement_funnel", 4),
    b("top_pages", 5), b("devices", 4), b("session_time", 3),
    b("retention", 6), b("top_events", 6),
  ],
  acquisition: [
    b("kpi_new_users", 2), b("kpi_activation", 2), b("kpi_survey_conversion", 2), b("kpi_pages_per_session", 2), b("kpi_recurrent", 2),
    b("channels_trend", 8), b("channels_donut", 4),
    b("channels_table", 7), b("entry_pages", 5),
    b("acquisition_funnel", 7), b("campaigns", 5),
  ],
  engagement: [
    b("kpi_dau", 2), b("kpi_mau", 2), b("kpi_session_time", 2), b("kpi_sessions_per_user", 2), b("kpi_task_success", 2), b("kpi_north_star", 2),
    b("engagement_trend", 8), b("frequency", 4),
    b("features", 6), b("top_pages", 6),
    b("hours", 6), b("devices", 3), b("device_time", 3),
  ],
  retention: [
    b("kpi_d1", 3), b("kpi_d7", 3), b("kpi_d30", 3), b("kpi_recurrent", 3),
    b("retention_curve", 5), b("retention", 7),
    b("frequency", 4), b("engagement_funnel", 8),
  ],
  pages: [b("top_pages", 12), b("entry_pages", 6), b("exit_pages", 6)],
  devices: [b("devices", 4), b("device_time", 4), b("viewports", 4), b("os", 6), b("browsers", 6), b("device_trend", 12)],
  events: [b("top_events", 12), b("events_trend", 12)],
};

/** Tamanho padrão de cada bloco na visão personalizada. */
export function defaultSpan(id: WidgetId): number {
  if (id.startsWith("kpi_")) return 3;
  if (["users_trend", "channels_trend", "engagement_trend", "device_trend", "events_trend", "channels_table", "acquisition_funnel"].includes(id)) return 8;
  if (["top_pages", "top_events", "retention", "features", "hours"].includes(id)) return 6;
  return 4;
}

/** Consultas de que cada bloco depende. */
export const WIDGET_DATASETS: Record<WidgetId, Dataset[]> = {
  kpi_dau: ["daily"],
  kpi_mau: ["totals", "mau"],
  kpi_new_users: ["newUsers"],
  kpi_session_time: ["totals", "daily"],
  kpi_sessions_per_user: ["totals", "daily"],
  kpi_stickiness: ["daily", "totals"],
  kpi_north_star: ["configured"],
  kpi_task_success: ["configured"],
  kpi_activation: ["outcomes", "outcomesPrev", "newUsers"],
  kpi_survey_conversion: ["outcomes", "outcomesPrev", "newUsers"],
  kpi_pages_per_session: ["totals", "daily"],
  kpi_recurrent: ["recurrent"],
  kpi_d1: ["retention"],
  kpi_d7: ["retention"],
  kpi_d30: ["retention"],
  users_trend: ["daily", "mau"],
  engagement_funnel: ["funnel"],
  top_pages: ["pages"],
  devices: ["devices"],
  session_time: ["daily", "totals"],
  retention: ["retention"],
  retention_curve: ["retention"],
  top_events: ["events", "configured"],
  channels_trend: ["newUsers"],
  channels_donut: ["newUsers"],
  channels_table: ["outcomes", "channels"],
  entry_pages: ["entry", "outcomes"],
  exit_pages: ["exit", "pages"],
  acquisition_funnel: ["totals", "configured"],
  campaigns: ["campaigns", "outcomes"],
  engagement_trend: ["daily"],
  frequency: ["frequency"],
  features: ["events", "configured"],
  hours: ["hours"],
  device_time: ["devices"],
  os: ["techs"],
  browsers: ["techs"],
  viewports: ["techs"],
  device_trend: ["deviceTrend"],
  events_trend: ["events", "eventTrend"],
};

export function datasetsFor(widgets: WidgetId[]): Set<Dataset> {
  return new Set(widgets.flatMap((w) => WIDGET_DATASETS[w] ?? []));
}

/* ---------- KPIs ---------- */

export interface Kpi {
  value: number | null;
  /** variação: % (contagens) ou p.p. (taxas) */
  delta: { value: number; unit: "%" | "p.p." } | null;
  series: number[];
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : 0);
const pp = (cur: number | null, prev: number | null) => (cur === null || prev === null ? null : { value: Math.round((cur - prev) * 1000) / 10, unit: "p.p." as const });
const pc = (cur: number, prev: number | null | undefined) => {
  const v = pctChange(cur, prev);
  return v === null ? null : { value: v, unit: "%" as const };
};
const ratio = (a: number | undefined, b: number | undefined) => (a !== undefined && b ? a / b : null);

export function kpis(d: AnalyticsData) {
  const cur = d.daily?.cur ?? [];
  const prev = d.daily?.prev ?? [];
  const t = d.totals;
  const c = d.configured ?? {};
  const dau = avg(cur.map((x) => x.users));
  const dauPrev = prev.length ? avg(prev.map((x) => x.users)) : null;
  const out = {
    dau: { value: Math.round(dau), delta: dauPrev ? pc(dau, dauPrev) : null, series: cur.map((x) => x.users) } as Kpi,
    mau: { value: t?.mau ?? null, delta: t ? pc(t.mau, t.mau_prev) : null, series: (d.mau ?? []).map((x) => x.mau) } as Kpi,
    sessionTime: { value: t?.ms ?? null, delta: t ? pc(t.ms, t.ms_prev) : null, series: cur.map((x) => x.ms) } as Kpi,
    sessionsPerUser: {
      value: ratio(t?.sessions, t?.users),
      delta: t && t.users_prev ? pc(t.sessions / Math.max(1, t.users), t.sessions_prev / t.users_prev) : null,
      series: cur.map((x) => (x.users ? x.sessions / x.users : 0)),
    } as Kpi,
    pagesPerSession: {
      value: ratio(t?.pv, t?.sessions),
      delta: t && t.sessions_prev ? pc(t.pv / Math.max(1, t.sessions), t.pv_prev / t.sessions_prev) : null,
      series: cur.map((x) => (x.sessions ? x.pv / x.sessions : 0)),
    } as Kpi,
    stickiness: (() => {
      const v = t?.mau ? dau / t.mau : null;
      const p = t?.mau_prev && dauPrev !== null ? dauPrev / t.mau_prev : null;
      return { value: v, delta: pp(v, p), series: [] } as Kpi;
    })(),
    northStar: (() => {
      if (c.ns === undefined) return null;
      const v = ratio(c.ns, c.active);
      return { value: v, delta: pp(v, ratio(c.ns_prev, c.active_prev)), series: [] } as Kpi;
    })(),
    taskSuccess: (() => {
      if (c.td === undefined || c.ts === undefined) return null;
      const v = ratio(c.td, c.ts);
      return { value: v, delta: pp(v, ratio(c.td_prev, c.ts_prev)), series: [] } as Kpi;
    })(),
  };
  return out;
}

export function acquisitionKpis(d: AnalyticsData) {
  const o = d.outcomes ?? [];
  const op = d.outcomesPrev ?? [];
  const sum = (xs: typeof o, k: "users" | "activated" | "surveyed") => xs.reduce((a, x) => a + x[k], 0);
  const act = ratio(sum(o, "activated"), sum(o, "users"));
  const actPrev = ratio(sum(op, "activated"), sum(op, "users"));
  const sv = ratio(sum(o, "surveyed"), sum(o, "users"));
  const svPrev = ratio(sum(op, "surveyed"), sum(op, "users"));
  const byDay = new Map<string, number>();
  for (const x of d.newUsers?.byDay ?? []) byDay.set(x.d, (byDay.get(x.d) ?? 0) + x.users);
  const r = d.recurrent;
  return {
    newUsers: { value: d.newUsers?.cur ?? null, delta: d.newUsers ? pc(d.newUsers.cur, d.newUsers.prev) : null, series: [...byDay.values()] } as Kpi,
    activation: { value: act, delta: pp(act, actPrev), series: [] } as Kpi,
    surveyConversion: { value: sv, delta: pp(sv, svPrev), series: [] } as Kpi,
    recurrent: { value: r?.cur ?? null, delta: pp(r?.cur ?? null, r?.prev ?? null), series: [] } as Kpi,
  };
}

/* ---------- canais ---------- */

/** Novos usuários por dia e canal, no formato do gráfico empilhado (uma linha por dia). */
export function channelSeries(d: AnalyticsData) {
  const days = new Map<string, Record<string, number | string>>();
  const present = new Set<Channel>();
  for (const x of d.newUsers?.byDay ?? []) {
    const row = days.get(x.d) ?? { d: x.d };
    row[x.channel] = ((row[x.channel] as number) ?? 0) + x.users;
    present.add(x.channel);
    days.set(x.d, row);
  }
  // canal sem novos usuários num dia = 0 (sem isso as áreas empilhadas ficam com buracos)
  for (const row of days.values()) for (const ch of present) row[ch] ??= 0;
  return [...days.values()].sort((a, b) => String(a.d).localeCompare(String(b.d)));
}

export function channelShares(d: AnalyticsData) {
  const tot = new Map<Channel, number>();
  for (const x of d.newUsers?.byDay ?? []) tot.set(x.channel, (tot.get(x.channel) ?? 0) + x.users);
  const all = [...tot.values()].reduce((a, x) => a + x, 0);
  return CHANNELS.map((ch) => ({ channel: ch, users: tot.get(ch) ?? 0, share: all ? (tot.get(ch) ?? 0) / all : 0 }))
    .filter((x) => x.users > 0)
    .sort((a, b) => b.users - a.users);
}

/** Tabela de canais: novos (e o que fizeram) + ativos e tempo médio das sessões do canal. */
export function channelTable(d: AnalyticsData) {
  const rows = new Map<Channel, { channel: Channel; newUsers: number; activated: number; surveyed: number; active: number; ms: number }>();
  const get = (ch: Channel) => rows.get(ch) ?? rows.set(ch, { channel: ch, newUsers: 0, activated: 0, surveyed: 0, active: 0, ms: 0 }).get(ch)!;
  for (const x of d.outcomes ?? []) {
    const r = get(x.channel);
    r.newUsers += x.users;
    r.activated += x.activated;
    r.surveyed += x.surveyed;
  }
  for (const x of d.channels ?? []) {
    const r = get(x.channel);
    r.active = x.users;
    r.ms = x.ms;
  }
  return [...rows.values()].sort((a, b) => b.newUsers - a.newUsers || b.active - a.active);
}

/** Entradas: sessões por página de entrada + ativação dos novos que entraram por ela. */
export function entryTable(d: AnalyticsData) {
  const nu = new Map<string, { users: number; activated: number }>();
  for (const x of d.outcomes ?? []) {
    const r = nu.get(x.landing) ?? { users: 0, activated: 0 };
    r.users += x.users;
    r.activated += x.activated;
    nu.set(x.landing, r);
  }
  return (d.entry ?? []).map((e) => ({ ...e, newUsers: nu.get(e.path)?.users ?? 0, activation: nu.get(e.path)?.users ? nu.get(e.path)!.activated / nu.get(e.path)!.users : null }));
}

export function campaignTable(d: AnalyticsData) {
  const nu = new Map<string, { users: number; activated: number }>();
  for (const x of d.outcomes ?? []) {
    if (!x.campaign) continue;
    const r = nu.get(x.campaign) ?? { users: 0, activated: 0 };
    r.users += x.users;
    r.activated += x.activated;
    nu.set(x.campaign, r);
  }
  return (d.campaigns ?? []).map((c) => ({ ...c, newUsers: nu.get(c.campaign)?.users ?? 0, activation: nu.get(c.campaign)?.users ? nu.get(c.campaign)!.activated / nu.get(c.campaign)!.users : null }));
}

/* ---------- retenção ---------- */

/** Matriz de cohorts em % (célula = ativos na semana k / tamanho do cohort). */
export function retentionMatrix(d: AnalyticsData) {
  const list = d.retention?.cohorts ?? [];
  return list.map((c) => ({ cohort: c.cohort, size: c.size, pct: c.weeks.map((w) => (c.size ? w / c.size : 0)) }));
}

/** Curva média de retenção (média ponderada pelo tamanho dos cohorts que já têm a semana k). */
export function retentionCurve(d: AnalyticsData, weeks = 8) {
  const list = d.retention?.cohorts ?? [];
  return Array.from({ length: weeks }, (_, k) => {
    const eligible = list.filter((c) => c.weeks.length > k || isOldEnough(c.cohort, k));
    const size = eligible.reduce((a, c) => a + c.size, 0);
    const back = eligible.reduce((a, c) => a + (c.weeks[k] ?? 0), 0);
    return { week: k, pct: size ? back / size : null };
  }).filter((x) => x.pct !== null);
}

function isOldEnough(cohort: string, k: number, now = Date.now()) {
  return new Date(`${cohort}T00:00:00-03:00`).getTime() + (k + 1) * 7 * 86_400_000 <= now;
}

/* ---------- horários ---------- */

/** Grade 7×24 (segunda a domingo × hora) normalizada 0–1. */
export function hoursGrid(d: AnalyticsData) {
  const grid = Array.from({ length: 7 }, () => new Array(24).fill(0));
  for (const x of d.hours ?? []) if (x.dow >= 1 && x.dow <= 7 && x.h >= 0 && x.h < 24) grid[x.dow - 1][x.h] = x.users;
  const max = Math.max(1, ...grid.flat());
  return { grid, max, norm: grid.map((r) => r.map((v) => v / max)) };
}

/** Agrega uma série diária em semanas (soma ou média). */
export function weekly<T extends { d: string }>(rows: T[], keys: (keyof T)[], mode: "sum" | "avg" = "avg") {
  const out = new Map<string, { d: string; n: number } & Record<string, number>>();
  for (const r of rows) {
    const dt = new Date(`${r.d}T12:00:00-03:00`);
    const monday = new Date(dt.getTime() - ((dt.getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10);
    const acc = out.get(monday) ?? ({ d: monday, n: 0 } as { d: string; n: number } & Record<string, number>);
    acc.n++;
    for (const k of keys) acc[k as string] = (acc[k as string] ?? 0) + Number(r[k] ?? 0);
    out.set(monday, acc);
  }
  return [...out.values()].map((a) => {
    const o: Record<string, number | string> = { d: a.d };
    for (const k of keys) o[k as string] = mode === "avg" ? (a[k as string] ?? 0) / a.n : a[k as string] ?? 0;
    return o;
  });
}
