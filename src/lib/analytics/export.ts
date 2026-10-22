/*
  Exportação do Analytics (CSV, XLSX e PDF): o que a visão mostra, em tabelas. KPIs numa tabela
  só; cada consulta dos blocos da visão vira uma tabela com colunas em português. PURO e testado.
*/
import { CHANNEL_LABEL, WIDGETS, type Channel, type WidgetId } from "./core";
import { acquisitionKpis, kpis, type Kpi } from "./derive";
import type { AnalyticsData, UserRow } from "@/lib/db/analytics";

export interface ExportTable {
  title: string;
  columns: string[];
  rows: (string | number | null)[][];
}

export function fmtDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "";
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${String(s % 60).padStart(2, "0")}s`;
}
const br = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const pct = (v: number | null | undefined) => (v === null || v === undefined ? null : `${br(v * 100)}%`);
/** "2026-10-05T07" (por hora) → "05/10 07h"; "2026-10-05" → "05/10/2026". */
export function fmtBucket(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}))?/.exec(d);
  if (!m) return d;
  return m[4] ? `${m[3]}/${m[2]} ${m[4]}h` : `${m[3]}/${m[2]}/${m[1]}`;
}
const dec = (v: number | null | undefined) => (v === null || v === undefined ? null : Math.round(v * 100) / 100);
const ch = (c: string) => CHANNEL_LABEL[c as Channel] ?? c;
const delta = (k: Kpi | null) => (k?.delta ? `${k.delta.value > 0 ? "+" : ""}${br(k.delta.value)}${k.delta.unit === "%" ? "%" : " p.p."}` : null);
const DOW = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const DEVICE: Record<string, string> = { desktop: "Desktop", mobile: "Celular", tablet: "Tablet" };
const dev = (d: string) => DEVICE[d] ?? d;
const FREQ: Record<string, string> = { daily: "Diário", weekly: "Semanal", monthly: "Mensal", sporadic: "Esporádico" };

/** KPIs da visão: valor formatado e variação contra o período anterior. */
function kpiTable(d: AnalyticsData, widgets: WidgetId[]): ExportTable | null {
  const k = kpis(d);
  const a = acquisitionKpis(d);
  const r = d.retention;
  const map: Partial<Record<WidgetId, [string | number | null, string | null]>> = {
    kpi_dau: [k.dau.value, delta(k.dau)],
    kpi_mau: [k.mau.value, delta(k.mau)],
    kpi_session_time: [fmtDuration(k.sessionTime.value), delta(k.sessionTime)],
    kpi_sessions_per_user: [dec(k.sessionsPerUser.value), delta(k.sessionsPerUser)],
    kpi_pages_per_session: [dec(k.pagesPerSession.value), delta(k.pagesPerSession)],
    kpi_stickiness: [pct(k.stickiness.value), delta(k.stickiness)],
    kpi_north_star: [k.northStar ? pct(k.northStar.value) : "Não configurado", delta(k.northStar)],
    kpi_task_success: [k.taskSuccess ? pct(k.taskSuccess.value) : "Não configurado", delta(k.taskSuccess)],
    kpi_new_users: [a.newUsers.value, delta(a.newUsers)],
    kpi_activation: [pct(a.activation.value), delta(a.activation)],
    kpi_survey_conversion: [pct(a.surveyConversion.value), delta(a.surveyConversion)],
    kpi_recurrent: [pct(a.recurrent.value), delta(a.recurrent)],
    kpi_d1: [pct(r?.d1), null],
    kpi_d7: [pct(r?.d7), null],
    kpi_d30: [pct(r?.d30), null],
  };
  const rows = widgets.filter((w) => w in map).map((w) => [WIDGETS[w], ...map[w]!]);
  return rows.length ? { title: "Indicadores", columns: ["Indicador", "Valor", "Variação vs. período anterior"], rows } : null;
}

/** Tabelas da visão, na ordem dos blocos, sem repetir a mesma consulta. */
export function analyticsTables(d: AnalyticsData, widgets: WidgetId[]): ExportTable[] {
  const out: ExportTable[] = [];
  const kt = kpiTable(d, widgets);
  if (kt) out.push(kt);
  const done = new Set<string>();
  const add = (key: string, t: () => ExportTable | null) => {
    if (done.has(key)) return;
    done.add(key);
    const v = t();
    if (v) out.push(v);
  };

  for (const w of widgets) {
    switch (w) {
      case "users_trend":
      case "engagement_trend":
      case "session_time":
        add("daily", () => {
          const mau = new Map((d.mau ?? []).map((x) => [x.d, x.mau]));
          return {
            title: "Uso por dia",
            columns: ["Data", "Usuários ativos", "MAU", "Sessões", "Telas vistas", "Tempo médio por sessão"],
            rows: (d.daily?.cur ?? []).map((x) => [fmtBucket(x.d), x.users, mau.get(x.d) ?? null, x.sessions, x.pv, fmtDuration(x.ms)]),
          };
        });
        break;
      case "engagement_funnel":
        add("funnel", () => {
          const steps = d.funnel?.steps ?? [];
          const first = steps[0]?.n || 0;
          return { title: "Funil de engajamento", columns: ["Etapa", "Usuários", "% do início"], rows: steps.map((s) => [s.label, s.n, first ? pct(s.n / first) : null]) };
        });
        break;
      case "top_pages":
        add("pages", () => ({
          title: "Páginas mais acessadas",
          columns: ["Plataforma", "Página", "Acessos", "Usuários", "Tempo médio"],
          rows: (d.pages ?? []).map((x) => [x.host, `/${x.path}`, x.pv, x.users, fmtDuration(x.ms)]),
        }));
        break;
      case "entry_pages":
        add("entry", () => ({ title: "Páginas de entrada", columns: ["Página", "Sessões", "Usuários"], rows: (d.entry ?? []).map((x) => [`/${x.path}`, x.sessions, x.users]) }));
        break;
      case "exit_pages":
        add("exit", () => ({ title: "Páginas de saída", columns: ["Página", "Saídas"], rows: (d.exit ?? []).map((x) => [`/${x.path}`, x.exits]) }));
        break;
      case "devices":
      case "device_time":
        add("devices", () => ({
          title: "Dispositivos",
          columns: ["Dispositivo", "Usuários", "Sessões", "Tempo médio por sessão"],
          rows: (d.devices ?? []).map((x) => [dev(x.device), x.users, x.sessions, fmtDuration(x.ms)]),
        }));
        break;
      case "device_trend":
        add("deviceTrend", () => ({ title: "Usuários por dispositivo no tempo", columns: ["Data", "Dispositivo", "Usuários"], rows: (d.deviceTrend ?? []).map((x) => [fmtBucket(x.d), dev(x.device), x.users]) }));
        break;
      case "os":
        add("os", () => ({ title: "Sistemas operacionais", columns: ["Sistema", "Usuários"], rows: (d.techs?.os ?? []).map((x) => [x.name, x.users]) }));
        break;
      case "browsers":
        add("browser", () => ({ title: "Navegadores", columns: ["Navegador", "Usuários"], rows: (d.techs?.browser ?? []).map((x) => [x.name, x.users]) }));
        break;
      case "viewports":
        add("viewport", () => ({ title: "Largura da janela", columns: ["Largura", "Usuários"], rows: (d.techs?.viewport ?? []).map((x) => [x.name, x.users]) }));
        break;
      case "retention":
      case "retention_curve":
        add("retention", () => {
          const cohorts = d.retention?.cohorts ?? [];
          const weeks = Math.max(0, ...cohorts.map((c) => c.weeks.length));
          return {
            title: "Retenção por cohort semanal",
            columns: ["Cohort (semana)", "Usuários", ...Array.from({ length: Math.max(0, weeks - 1) }, (_, i) => `Semana ${i + 1}`)],
            rows: cohorts.map((c) => [c.cohort, c.size, ...c.weeks.slice(1).map((v) => (c.size ? pct(v / c.size) : null))]),
          };
        });
        break;
      case "top_events":
      case "features":
        add("events", () => ({ title: "Eventos", columns: ["Evento", "Ocorrências", "Usuários", "Sessões"], rows: (d.events ?? []).map((x) => [x.name, x.total, x.users, x.sessions]) }));
        break;
      case "events_trend":
        add("eventTrend", () => ({ title: "Eventos no tempo", columns: ["Data", "Evento", "Usuários"], rows: (d.eventTrend ?? []).map((x) => [fmtBucket(x.d), x.name, x.users]) }));
        break;
      case "channels_trend":
        add("newUsers", () => ({ title: "Novos usuários por canal", columns: ["Data", "Canal", "Novos usuários"], rows: (d.newUsers?.byDay ?? []).map((x) => [fmtBucket(x.d), ch(x.channel), x.users]) }));
        break;
      case "channels_donut":
      case "channels_table":
        add("channels", () => ({
          title: "Canais",
          columns: ["Canal", "Usuários", "Sessões", "Tempo médio por sessão"],
          rows: (d.channels ?? []).map((x) => [ch(x.channel), x.users, x.sessions, fmtDuration(x.ms)]),
        }));
        break;
      case "acquisition_funnel":
        add("outcomes", () => ({
          title: "Novos usuários: ativação e pesquisa",
          columns: ["Canal", "Página de entrada", "Campanha", "Novos usuários", "Ativados", "Responderam pesquisa"],
          rows: (d.outcomes ?? []).map((x) => [ch(x.channel), x.landing ? `/${x.landing}` : null, x.campaign, x.users, x.activated, x.surveyed]),
        }));
        break;
      case "campaigns":
        add("campaigns", () => ({
          title: "Campanhas",
          columns: ["Campanha", "Canal", "Origem", "Sessões", "Usuários"],
          rows: (d.campaigns ?? []).map((x) => [x.campaign, ch(x.channel), x.source, x.sessions, x.users]),
        }));
        break;
      case "frequency":
        add("frequency", () => ({ title: "Frequência de uso", columns: ["Frequência", "Usuários"], rows: Object.entries(d.frequency ?? {}).map(([k, v]) => [FREQ[k] ?? k, v]) }));
        break;
      case "hours":
        add("hours", () => ({
          title: "Usuários por dia da semana e hora",
          columns: ["Dia da semana", "Hora", "Usuários"],
          rows: (d.hours ?? []).map((x) => [DOW[x.dow] ?? String(x.dow), `${String(x.h).padStart(2, "0")}h`, x.users]),
        }));
        break;
    }
  }
  return out;
}

/** Lista de usuários (aba Usuários). */
export function usersTable(rows: UserRow[]): ExportTable {
  return {
    title: "Usuários",
    columns: ["Nome", "E-mail", "ID", "Última atividade", "Sessões", "Telas", "Tempo ativo", "Dias ativos", "Ações", "Dispositivo", "Origem", "Primeira visita"],
    rows: rows.map((u) => [
      u.name,
      u.email,
      u.userId ?? `anônimo ${u.anonId}`,
      new Date(u.lastSeenAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      u.sessions,
      u.pageviews,
      fmtDuration(u.ms),
      u.days,
      u.events,
      dev(u.device),
      ch(u.channel),
      new Date(u.firstSeenAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    ]),
  };
}
