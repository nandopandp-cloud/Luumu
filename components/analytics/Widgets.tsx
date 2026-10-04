"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Clock,
  FileText,
  Flag,

  Heart,
  Layers,
  LogIn,
  Monitor,
  MousePointerClick,
  Repeat,
  Settings2,
  Smartphone,
  Sparkles,
  Tablet,
  Target,
  TrendingUp,
  UserPlus,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { InsightCard, type Tone } from "@/components/ui/InsightCard";
import { Select } from "@/components/ui/Select";
import {
  CHANNEL_COLOR,
  CHANNEL_LABEL,
  CHANNELS,
  eventLabel,
  FREQUENCY_LABEL,
  fmtDec,
  fmtInt,
  fmtPct,
  formatDuration,
  SURVEY_EVENT,
  WIDGETS,
  type Frequency,
  type WidgetId,
} from "@/lib/analytics/core";
import {
  acquisitionKpis,
  campaignTable,
  channelSeries,
  channelShares,
  channelTable,
  entryTable,
  hoursGrid,
  kpis,
  retentionCurve,
  retentionMatrix,
  weekly,
  type Kpi,
} from "@/lib/analytics/derive";
import type { AnalyticsData } from "@/lib/db/analytics";

/* ---------- contexto ---------- */

export interface WidgetCtx {
  data: AnalyticsData;
  multiHost: boolean;
  /** abre o diálogo de métricas (North Star, tarefa, ativação) */
  onConfigure?: () => void;
  canConfigure: boolean;
  /** KPIs em faixa cheia (5–6 por linha): versão compacta */
  dense?: boolean;
  settings: { northStarEvent: string | null; activationEvent: string | null; taskStartEvent: string | null; taskDoneEvent: string | null };
}

const axis = { fontSize: 11, fill: "var(--text-mut)", fontFamily: "var(--font-mono)" };
const shortDay = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const DEVICE_NAME: Record<string, string> = { desktop: "Desktop", mobile: "Mobile", tablet: "Tablet" };
const DEVICE_ICON: Record<string, LucideIcon> = { desktop: Monitor, mobile: Smartphone, tablet: Tablet };
const DEVICE_COLOR: Record<string, string> = { desktop: "#6B2BD9", mobile: "#A78BFA", tablet: "#DDD0FF" };
const PURPLES = ["#6B2BD9", "#8B5CF6", "#A78BFA", "#C4B5FD", "#DDD6FE", "#EDE9FE", "#94A3B8", "#CBD5E1"];

function pagePath(host: string, path: string, multiHost: boolean) {
  const p = path === "home" || !path ? "/" : `/${path.replace(/^\/+/, "")}`;
  return multiHost && host ? `${host}${p}` : p;
}

function ChartTip({ active, payload, label, fmt }: { active?: boolean; payload?: { name: string; value: number; color?: string; stroke?: string; fill?: string; dataKey?: string }[]; label?: string; fmt?: (v: number, key?: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-bg-elev px-3 py-2 text-xs shadow-[var(--shadow-md)]">
      {label && <div className="mb-1 font-semibold text-fg">{/^\d{4}-\d{2}-\d{2}$/.test(label) ? shortDay(label) : label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-fg-soft">
          <span className="size-2 rounded-full" style={{ background: p.color || p.stroke || p.fill }} />
          {p.name}: <span className="font-semibold text-fg">{fmt ? fmt(p.value, p.dataKey) : fmtInt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- moldura ---------- */

export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex h-full min-w-0 flex-col rounded-2xl border border-line bg-bg-elev p-5 shadow-[var(--shadow-sm)]", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-[17px] font-bold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[13px] text-fg-mut">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

function Empty({ text = "Sem dados neste recorte." }: { text?: string }) {
  return <div className="flex flex-1 items-center justify-center py-10 text-center text-sm text-fg-mut">{text}</div>;
}

function MiniBar({ value, max, color = "var(--accent)" }: { value: number; max: number; color?: string }) {
  return (
    <div className="h-1.5 w-full min-w-[48px] overflow-hidden rounded-full bg-bg-sunken">
      <div className="h-full rounded-full" style={{ width: `${max ? Math.max(3, (value / max) * 100) : 0}%`, background: color }} />
    </div>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn("border-b border-line pb-2 pl-3 text-left align-bottom font-mono text-[10px] font-semibold uppercase leading-tight tracking-[0.06em] text-fg-mut first:pl-0", className)}>{children}</th>;
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("border-b border-line/60 py-2.5 pl-3 text-[13px] tabular-nums first:pl-0", className)}>{children}</td>;
}

/* ---------- KPIs ---------- */

const KPI_META: Partial<Record<WidgetId, { icon: LucideIcon; tone: Tone; hint: string }>> = {
  kpi_dau: { icon: Activity, tone: "roxo", hint: "Média de usuários únicos por dia no período." },
  kpi_mau: { icon: Users, tone: "roxo", hint: "Usuários únicos nos 30 dias que terminam no fim do período." },
  kpi_new_users: { icon: UserPlus, tone: "roxo", hint: "Usuários vistos pela primeira vez no período." },
  kpi_session_time: { icon: Clock, tone: "laranja", hint: "Tempo ATIVO médio por sessão (aba visível e com interação)." },
  kpi_sessions_per_user: { icon: Repeat, tone: "azul", hint: "Sessões no período ÷ usuários ativos." },
  kpi_stickiness: { icon: Heart, tone: "roxo", hint: "DAU médio ÷ MAU: quanto do público mensal volta todo dia." },
  kpi_north_star: { icon: Target, tone: "verde", hint: "% dos usuários ativos que realizaram o evento North Star." },
  kpi_task_success: { icon: CheckCircle2, tone: "azul", hint: "Dos que iniciaram a tarefa, % que concluíram." },
  kpi_activation: { icon: Zap, tone: "azul", hint: "Novos usuários que se ativaram nos primeiros 7 dias." },
  kpi_survey_conversion: { icon: Sparkles, tone: "verde", hint: "Novos usuários que responderam uma pesquisa nos primeiros 7 dias." },
  kpi_pages_per_session: { icon: Layers, tone: "laranja", hint: "Telas vistas por sessão, em média." },
  kpi_recurrent: { icon: CalendarCheck, tone: "roxo", hint: "Ativos nos últimos 30 dias que usaram o produto em 2 ou mais dias." },
  kpi_d1: { icon: TrendingUp, tone: "roxo", hint: "Dos usuários com 1+ dia de casa, % que voltaram depois do 1º dia." },
  kpi_d7: { icon: TrendingUp, tone: "azul", hint: "Dos usuários com 7+ dias de casa, % que voltaram depois de 7 dias." },
  kpi_d30: { icon: TrendingUp, tone: "verde", hint: "Dos usuários com 30+ dias de casa, % que voltaram depois de 30 dias." },
};

function SetupKpi({ label, icon: Icon, text, ctx }: { label: string; icon: LucideIcon; text: string; ctx: WidgetCtx }) {
  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-dashed border-accent/40 bg-surface-brand/30 p-5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-fg-soft">{label}</span>
        <span className="grid size-10 place-items-center rounded-full bg-surface-brand text-accent">
          <Icon className="size-5" />
        </span>
      </div>
      <p className="mt-2 text-xs leading-snug text-fg-mut">{text}</p>
      {ctx.canConfigure && ctx.onConfigure ? (
        <button type="button" onClick={ctx.onConfigure} className="mt-3 inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-accent hover:underline">
          <Settings2 className="size-4" /> Configurar
        </button>
      ) : (
        <span className="mt-3 text-xs text-fg-mut">Peça a um editor para configurar.</span>
      )}
    </div>
  );
}

function KpiCard({ id, k, fmt, ctx }: { id: WidgetId; k: Kpi | null; fmt: (v: number) => string; ctx: WidgetCtx }) {
  const m = KPI_META[id]!;
  const Icon = m.icon;
  if (id === "kpi_north_star" && !k) return <SetupKpi label="North Star" icon={Target} text="Escolha o evento que representa o valor principal do seu produto." ctx={ctx} />;
  if (id === "kpi_task_success" && !k) return <SetupKpi label="Task Success" icon={CheckCircle2} text="Escolha os eventos de início e de conclusão da tarefa principal." ctx={ctx} />;
  const label = id === "kpi_north_star" && ctx.settings.northStarEvent ? `North Star · ${eventLabel(ctx.settings.northStarEvent)}` : WIDGETS[id];
  return (
    <InsightCard
      label={label}
      value={k?.value == null ? "–" : fmt(k.value)}
      tone={m.tone}
      icon={<Icon className="size-5" />}
      series={k?.series ?? []}
      delta={k?.delta ? { value: k.delta.value, unit: k.delta.unit } : null}
      hint={m.hint}
      dense={ctx.dense}
    />
  );
}

/* ---------- bloco a bloco ---------- */

export function Widget({ id, ctx }: { id: WidgetId; ctx: WidgetCtx }) {
  const d = ctx.data;
  const K = useMemo(() => kpis(d), [d]);
  const A = useMemo(() => acquisitionKpis(d), [d]);
  const active = d.configured?.active ?? d.totals?.users ?? 0;

  switch (id) {
    case "kpi_dau":
      return <KpiCard id={id} k={K.dau} fmt={fmtInt} ctx={ctx} />;
    case "kpi_mau":
      return <KpiCard id={id} k={K.mau} fmt={fmtInt} ctx={ctx} />;
    case "kpi_session_time":
      return <KpiCard id={id} k={K.sessionTime} fmt={formatDuration} ctx={ctx} />;
    case "kpi_sessions_per_user":
      return <KpiCard id={id} k={K.sessionsPerUser} fmt={fmtDec} ctx={ctx} />;
    case "kpi_pages_per_session":
      return <KpiCard id={id} k={K.pagesPerSession} fmt={fmtDec} ctx={ctx} />;
    case "kpi_stickiness":
      return <KpiCard id={id} k={K.stickiness} fmt={fmtPct} ctx={ctx} />;
    case "kpi_north_star":
      return <KpiCard id={id} k={K.northStar} fmt={fmtPct} ctx={ctx} />;
    case "kpi_task_success":
      return <KpiCard id={id} k={K.taskSuccess} fmt={fmtPct} ctx={ctx} />;
    case "kpi_new_users":
      return <KpiCard id={id} k={A.newUsers} fmt={fmtInt} ctx={ctx} />;
    case "kpi_activation":
      return <KpiCard id={id} k={A.activation} fmt={fmtPct} ctx={ctx} />;
    case "kpi_survey_conversion":
      return <KpiCard id={id} k={A.surveyConversion} fmt={fmtPct} ctx={ctx} />;
    case "kpi_recurrent":
      return <KpiCard id={id} k={A.recurrent} fmt={fmtPct} ctx={ctx} />;
    case "kpi_d1":
    case "kpi_d7":
    case "kpi_d30": {
      const v = d.retention?.[id === "kpi_d1" ? "d1" : id === "kpi_d7" ? "d7" : "d30"] ?? null;
      return <KpiCard id={id} k={{ value: v, delta: null, series: [] }} fmt={fmtPct} ctx={ctx} />;
    }
    case "users_trend":
      return <UsersTrend ctx={ctx} />;
    case "engagement_funnel":
      return <EngagementFunnel ctx={ctx} />;
    case "top_pages":
      return <TopPages ctx={ctx} />;
    case "devices":
      return <DevicesDonut ctx={ctx} />;
    case "session_time":
      return <SessionTime ctx={ctx} k={K.sessionTime} />;
    case "retention":
      return <RetentionTable ctx={ctx} />;
    case "retention_curve":
      return <RetentionCurveChart ctx={ctx} />;
    case "top_events":
      return <EventsTable ctx={ctx} active={active} title="Eventos e ações mais realizadas" />;
    case "features":
      return <EventsTable ctx={ctx} active={active} title="Funcionalidades mais utilizadas" features />;
    case "channels_trend":
      return <ChannelsTrend ctx={ctx} />;
    case "channels_donut":
      return <ChannelsDonut ctx={ctx} />;
    case "channels_table":
      return <ChannelsTable ctx={ctx} />;
    case "entry_pages":
      return <EntryPages ctx={ctx} />;
    case "exit_pages":
      return <ExitPages ctx={ctx} />;
    case "acquisition_funnel":
      return <AcquisitionFunnel ctx={ctx} />;
    case "campaigns":
      return <Campaigns ctx={ctx} />;
    case "engagement_trend":
      return <EngagementTrend ctx={ctx} />;
    case "frequency":
      return <FrequencyDonut ctx={ctx} />;
    case "hours":
      return <Hours ctx={ctx} />;
    case "device_time":
      return <DeviceTime ctx={ctx} />;
    case "os":
      return <RankList title="Sistemas operacionais" items={d.techs?.os ?? []} />;
    case "browsers":
      return <RankList title="Navegadores" items={d.techs?.browser ?? []} />;
    case "viewports":
      return <RankList title="Tamanhos de tela" subtitle="Largura da janela do navegador." items={d.techs?.viewport ?? []} />;
    case "device_trend":
      return <DeviceTrend ctx={ctx} />;
    case "events_trend":
      return <EventsTrend ctx={ctx} />;
    default:
      return null;
  }
}

/* ---------- gráficos e tabelas ---------- */

function Granularity({ value, onChange }: { value: "day" | "week"; onChange: (v: "day" | "week") => void }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value as "day" | "week")} aria-label="Agrupamento" className="w-auto min-w-[120px] py-1.5 text-sm">
      <option value="day">Diário</option>
      <option value="week">Semanal</option>
    </Select>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-soft">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

function UsersTrend({ ctx }: { ctx: WidgetCtx }) {
  const [g, setG] = useState<"day" | "week">("day");
  const rows = useMemo(() => {
    const mau = new Map((ctx.data.mau ?? []).map((m) => [m.d, m.mau]));
    let lastMau: number | null = null;
    const daily = (ctx.data.daily?.cur ?? []).map((x) => {
      const m = mau.get(x.d);
      if (m !== undefined) lastMau = m;
      return { d: x.d, dau: x.users, mau: m ?? lastMau ?? 0 };
    });
    return g === "week" ? weekly(daily, ["dau", "mau"]) : daily;
  }, [ctx.data, g]);
  return (
    <Panel
      title="Evolução de usuários"
      action={
        <div className="flex items-center gap-4">
          <Legend items={[{ label: "DAU", color: "#6B2BD9" }, { label: "MAU", color: "#C4B5FD" }]} />
          <Granularity value={g} onChange={setG} />
        </div>
      }
    >
      {rows.length < 2 ? (
        <Empty text="Ainda há poucos dias de dados para mostrar a evolução." />
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={rows} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="an-mau" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#A78BFA" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#A78BFA" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="an-dau" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6B2BD9" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#6B2BD9" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="d" tickFormatter={shortDay} tick={axis} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis tick={axis} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => fmtInt(v)} />
            <Tooltip content={<ChartTip fmt={(v) => fmtInt(v)} />} />
            <Area type="monotone" name="MAU" dataKey="mau" stroke="#A78BFA" strokeWidth={2.5} fill="url(#an-mau)" dot={false} />
            <Area type="monotone" name="DAU" dataKey="dau" stroke="#6B2BD9" strokeWidth={2.5} fill="url(#an-dau)" dot={{ r: 2.5, fill: "#6B2BD9", strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Panel>
  );
}

function EngagementFunnel({ ctx }: { ctx: WidgetCtx }) {
  const f = ctx.data.funnel;
  const top = f?.steps[0]?.n ?? 0;
  return (
    <Panel
      title="Funil de engajamento"
      subtitle={f?.configured ? undefined : "Etapas padrão. Configure os eventos da sua tarefa principal."}
      action={
        ctx.canConfigure && ctx.onConfigure ? (
          <button type="button" onClick={ctx.onConfigure} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-accent hover:bg-surface-brand" title="Configurar etapas">
            <Settings2 className="size-3.5" /> Etapas
          </button>
        ) : undefined
      }
    >
      {!f || !top ? (
        <Empty />
      ) : (
        <div className="flex flex-1 items-end gap-1.5 pt-2">
          {f.steps.map((s, i) => {
            const pct = top ? s.n / top : 0;
            return (
              <div key={s.label} className="flex flex-1 items-end gap-1.5">
                <div className="flex flex-1 flex-col items-center">
                  <span className="mb-1.5 font-display text-[15px] font-extrabold tabular-nums">{fmtInt(s.n)}</span>
                  <div className="relative flex h-[150px] w-full items-end">
                    <div
                      className="flex w-full items-end justify-center rounded-t-lg pb-1.5 text-[11px] font-bold text-white"
                      style={{ height: `${Math.max(8, pct * 100)}%`, background: `linear-gradient(180deg, ${PURPLES[i]} 0%, ${PURPLES[i + 1] ?? PURPLES[i]} 100%)`, color: i > 1 ? "#4C1D95" : "#fff" }}
                    >
                      {fmtPct(pct)}
                    </div>
                  </div>
                  <span className="mt-2 text-center text-[11px] leading-tight text-fg-soft">{s.label}</span>
                </div>
                {i < f.steps.length - 1 && <ArrowRight className="mb-[70px] size-3.5 shrink-0 text-fg-mut" />}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function TopPages({ ctx }: { ctx: WidgetCtx }) {
  const rows = ctx.data.pages ?? [];
  const [q, setQ] = useState("");
  const shown = rows.filter((r) => !q || pagePath(r.host, r.path, ctx.multiHost).toLowerCase().includes(q.toLowerCase()));
  const max = Math.max(1, ...rows.map((r) => r.pv));
  return (
    <Panel
      title="Páginas mais visitadas"
      action={
        rows.length > 10 ? (
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar páginas…" className="w-40 rounded-lg border border-line bg-bg px-2.5 py-1.5 text-xs outline-none focus:border-accent" />
        ) : undefined
      }
    >
      {!rows.length ? (
        <Empty />
      ) : (
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[460px]">
            <thead>
              <tr>
                <Th>Página</Th>
                <Th className="w-[18%]" />
                <Th className="text-right">Pageviews</Th>
                <Th className="text-right">Usuários únicos</Th>
                <Th className="text-right">Tempo médio</Th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.host + r.path}>
                  <Td className="max-w-[220px]">
                    <span className="flex items-center gap-2 truncate font-medium text-fg-soft" title={pagePath(r.host, r.path, ctx.multiHost)}>
                      <FileText className="size-3.5 shrink-0 text-fg-mut" />
                      <span className="truncate">{pagePath(r.host, r.path, ctx.multiHost)}</span>
                    </span>
                  </Td>
                  <Td className="pr-4">
                    <MiniBar value={r.pv} max={max} />
                  </Td>
                  <Td className="text-right">{fmtInt(r.pv)}</Td>
                  <Td className="text-right">{fmtInt(r.users)}</Td>
                  <Td className="text-right">{formatDuration(r.ms)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function Donut({ items, total, unit }: { items: { label: string; value: number; color: string }[]; total: number; unit: string }) {
  return (
    <div className="flex flex-1 flex-wrap items-center justify-center gap-6">
      <div className="relative size-[168px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={items} dataKey="value" nameKey="label" innerRadius={56} outerRadius={80} paddingAngle={2} stroke="none" startAngle={90} endAngle={-270}>
              {items.map((i) => (
                <Cell key={i.label} fill={i.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="font-display text-xl font-extrabold tabular-nums">{fmtInt(total)}</div>
            <div className="text-xs text-fg-mut">{unit}</div>
          </div>
        </div>
      </div>
      <ul className="flex min-w-[150px] flex-col gap-2.5">
        {items.map((i) => (
          <li key={i.label} className="flex items-center gap-2.5 text-sm">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: i.color }} />
            <span className="flex-1 text-fg-soft">{i.label}</span>
            <span className="font-bold tabular-nums">{total ? fmtPct(i.value / total) : "0%"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DevicesDonut({ ctx }: { ctx: WidgetCtx }) {
  const rows = ctx.data.devices ?? [];
  const total = rows.reduce((a, r) => a + r.users, 0);
  return (
    <Panel title="Dispositivos mais utilizados">
      {!total ? (
        <Empty />
      ) : (
        <Donut total={total} unit="usuários" items={rows.map((r) => ({ label: DEVICE_NAME[r.device] ?? r.device, value: r.users, color: DEVICE_COLOR[r.device] ?? "#CBD5E1" }))} />
      )}
    </Panel>
  );
}

function SessionTime({ ctx, k }: { ctx: WidgetCtx; k: Kpi }) {
  const rows = (ctx.data.daily?.cur ?? []).map((x) => ({ d: x.d, min: x.ms / 60000 }));
  const delta = k.delta;
  return (
    <Panel title="Tempo médio de sessão por usuário">
      <div className="flex items-end gap-3">
        <span className="font-display text-[30px] font-extrabold leading-none text-accent">{k.value == null ? "–" : formatDuration(k.value)}</span>
        {delta && (
          <span className={cn("mb-1 text-sm font-bold", delta.value >= 0 ? "text-sucesso" : "text-erro")}>
            {delta.value >= 0 ? "↑" : "↓"} {Math.abs(delta.value).toLocaleString("pt-BR")}%
          </span>
        )}
      </div>
      <span className="text-xs text-fg-mut">{delta ? "vs. período anterior" : " "}</span>
      {rows.length < 2 ? (
        <Empty text="Poucos dias de dados." />
      ) : (
        <ResponsiveContainer width="100%" height={150}>
          <AreaChart data={rows} margin={{ top: 10, right: 6, left: -6, bottom: 0 }}>
            <defs>
              <linearGradient id="an-st" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="d" tickFormatter={shortDay} tick={axis} axisLine={false} tickLine={false} minTickGap={30} />
            <YAxis tick={axis} axisLine={false} tickLine={false} width={40} tickFormatter={(v) => `${Math.round(v)}m`} />
            <Tooltip content={<ChartTip fmt={(v) => formatDuration(v * 60000)} />} />
            <Area type="monotone" name="Tempo médio" dataKey="min" stroke="#7C3AED" strokeWidth={2.5} fill="url(#an-st)" dot={{ r: 2.5, fill: "#7C3AED", strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Panel>
  );
}

function weekLabel(cohort: string) {
  const a = new Date(`${cohort}T12:00:00-03:00`);
  const b = new Date(a.getTime() + 6 * 86_400_000);
  const f = (x: Date) => x.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" }).replace(".", "");
  return `${f(a)} – ${f(b)}`;
}

function RetentionTable({ ctx }: { ctx: WidgetCtx }) {
  const m = retentionMatrix(ctx.data);
  const cols = Math.max(1, ...m.map((r) => r.pct.length));
  return (
    <Panel title="Retenção de usuários" subtitle="Cohorts semanais pela primeira visita: % que voltou em cada semana.">
      {!m.length ? (
        <Empty text="Os cohorts aparecem depois da primeira semana de coleta." />
      ) : (
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[520px] border-separate border-spacing-[3px]">
            <thead>
              <tr>
                <Th className="border-0">Semana</Th>
                <Th className="border-0 text-right">Usuários</Th>
                {Array.from({ length: cols }, (_, k) => (
                  <Th key={k} className="border-0 text-center">
                    {k}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {m.map((r) => (
                <tr key={r.cohort}>
                  <td className="whitespace-nowrap pr-2 text-xs text-fg-soft">{weekLabel(r.cohort)}</td>
                  <td className="pr-2 text-right text-xs tabular-nums text-fg-mut">{fmtInt(r.size)}</td>
                  {Array.from({ length: cols }, (_, k) => {
                    const v = r.pct[k];
                    return (
                      <td
                        key={k}
                        className="h-8 min-w-[44px] rounded-md text-center text-[11px] font-semibold tabular-nums"
                        style={
                          v === undefined
                            ? { color: "var(--text-mut)" }
                            : { background: `rgba(107,43,217,${0.1 + v * 0.85})`, color: v > 0.4 ? "#fff" : "var(--text-soft)" }
                        }
                        title={v === undefined ? "Semana ainda não chegou" : `${fmtPct(v)} voltaram na semana ${k}`}
                      >
                        {v === undefined ? "–" : fmtPct(v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function RetentionCurveChart({ ctx }: { ctx: WidgetCtx }) {
  const rows = retentionCurve(ctx.data).map((x) => ({ w: `Sem ${x.week}`, pct: Math.round((x.pct ?? 0) * 1000) / 10 }));
  return (
    <Panel title="Curva de retenção" subtitle="% médio dos cohorts que continua ativo em cada semana.">
      {rows.length < 2 ? (
        <Empty text="A curva aparece com duas semanas de dados." />
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="an-ret" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6B2BD9" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#6B2BD9" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="w" tick={axis} axisLine={false} tickLine={false} />
            <YAxis tick={axis} axisLine={false} tickLine={false} width={46} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <Tooltip content={<ChartTip fmt={(v) => `${v.toLocaleString("pt-BR")}%`} />} />
            <Area type="monotone" name="Retidos" dataKey="pct" stroke="#6B2BD9" strokeWidth={2.5} fill="url(#an-ret)" dot={{ r: 3.5, fill: "#6B2BD9", strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Panel>
  );
}

function eventIcon(name: string): LucideIcon {
  if (name === SURVEY_EVENT) return Sparkles;
  if (name.startsWith("click_") || name.startsWith("link_")) return MousePointerClick;
  if (name.startsWith("form_submit")) return CheckCircle2;
  if (name.startsWith("engaged_")) return Clock;
  if (name === "rage_click") return Flag;
  return Zap;
}

function EventsTable({ ctx, active, title, features }: { ctx: WidgetCtx; active: number; title: string; features?: boolean }) {
  const rows = ctx.data.events ?? [];
  const max = Math.max(1, ...rows.map((r) => r.users));
  return (
    <Panel title={title} subtitle={features ? "Ações do produto pelo alcance entre os usuários ativos." : undefined}>
      {!rows.length ? (
        <Empty text="Nenhum evento registrado neste recorte. Cliques e eventos de Luumu.track aparecem aqui." />
      ) : (
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[480px]">
            <thead>
              <tr>
                <Th>{features ? "Funcionalidade" : "Evento"}</Th>
                <Th className="w-[16%]" />
                <Th className="text-right">{features ? "Usuários" : "Total"}</Th>
                <Th className="text-right">{features ? "Taxa de uso" : "Usuários únicos"}</Th>
                <Th className="text-right">{features ? "Sessões" : "Taxa de conversão"}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const Icon = eventIcon(r.name);
                const rate = active ? r.users / active : 0;
                return (
                  <tr key={r.name}>
                    <Td className="max-w-[240px]">
                      <span className="flex items-center gap-2 font-medium text-fg-soft" title={r.name}>
                        <Icon className="size-3.5 shrink-0 text-accent" />
                        <span className="truncate">{eventLabel(r.name)}</span>
                      </span>
                    </Td>
                    <Td className="pr-4">
                      <MiniBar value={r.users} max={max} />
                    </Td>
                    <Td className="text-right">{fmtInt(features ? r.users : r.total)}</Td>
                    <Td className="text-right">{features ? fmtPct(rate) : fmtInt(r.users)}</Td>
                    <Td className="text-right">{features ? fmtInt(r.sessions) : fmtPct(rate)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function ChannelsTrend({ ctx }: { ctx: WidgetCtx }) {
  const [g, setG] = useState<"day" | "week">("day");
  const shares = channelShares(ctx.data);
  const raw = channelSeries(ctx.data) as ({ d: string } & Record<string, number>)[];
  const rows = g === "week" ? weekly(raw, CHANNELS as unknown as (keyof (typeof raw)[number])[], "sum") : raw;
  return (
    <Panel title="Novos usuários por canal" subtitle="Novos usuários ao longo do tempo, separados pelo canal de aquisição." action={<Granularity value={g} onChange={setG} />}>
      {rows.length < 2 ? (
        <Empty text="Ainda há poucos dias de dados." />
      ) : (
        <div className="flex flex-1 flex-col gap-4 lg:flex-row">
          <div className="min-w-0 flex-1">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={rows} margin={{ top: 8, right: 4, left: -10, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis dataKey="d" tickFormatter={shortDay} tick={axis} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis tick={axis} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => fmtInt(v)} />
                <Tooltip content={<ChartTip fmt={(v) => fmtInt(v)} />} />
                {[...shares].reverse().map((s) => (
                  <Area key={s.channel} type="monotone" stackId="1" name={CHANNEL_LABEL[s.channel]} dataKey={s.channel} stroke={CHANNEL_COLOR[s.channel]} fill={CHANNEL_COLOR[s.channel]} fillOpacity={0.35} strokeWidth={2} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <ul className="flex shrink-0 flex-col justify-center gap-2.5 lg:w-40">
            {shares.map((s) => (
              <li key={s.channel} className="flex items-center gap-2 text-sm">
                <span className="size-2.5 rounded-full" style={{ background: CHANNEL_COLOR[s.channel] }} />
                <span className="flex-1 text-fg-soft">{CHANNEL_LABEL[s.channel]}</span>
                <span className="font-bold tabular-nums">{fmtPct(s.share)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

function ChannelsDonut({ ctx }: { ctx: WidgetCtx }) {
  const shares = channelShares(ctx.data);
  const total = shares.reduce((a, s) => a + s.users, 0);
  return (
    <Panel title="Distribuição de novos usuários">
      {!total ? <Empty /> : <Donut total={total} unit="novos usuários" items={shares.map((s) => ({ label: CHANNEL_LABEL[s.channel], value: s.users, color: CHANNEL_COLOR[s.channel] }))} />}
    </Panel>
  );
}

function ChannelDot({ ch }: { ch: keyof typeof CHANNEL_LABEL }) {
  return (
    <span className="flex items-center gap-2 whitespace-nowrap font-medium text-fg-soft">
      <span className="size-2.5 shrink-0 rounded-full" style={{ background: CHANNEL_COLOR[ch] }} />
      {CHANNEL_LABEL[ch]}
    </span>
  );
}

function ChannelsTable({ ctx }: { ctx: WidgetCtx }) {
  const rows = channelTable(ctx.data);
  const max = Math.max(1, ...rows.map((r) => r.newUsers));
  const rate = (a: number, b: number) => (b ? fmtPct(a / b) : "–");
  return (
    <Panel title="Canais de aquisição">
      {!rows.length ? (
        <Empty />
      ) : (
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[620px]">
            <thead>
              <tr>
                <Th>Canal</Th>
                <Th className="w-[14%]" />
                <Th className="text-right">Novos usuários</Th>
                <Th className="text-right">Usuários ativos</Th>
                <Th className="text-right">Taxa de ativação</Th>
                <Th className="text-right">Conversão p/ pesquisa</Th>
                <Th className="text-right">Tempo médio de uso</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.channel}>
                  <Td>
                    <ChannelDot ch={r.channel} />
                  </Td>
                  <Td className="pr-4">
                    <MiniBar value={r.newUsers} max={max} color={CHANNEL_COLOR[r.channel]} />
                  </Td>
                  <Td className="text-right">{fmtInt(r.newUsers)}</Td>
                  <Td className="text-right">{fmtInt(r.active)}</Td>
                  <Td className="text-right">{rate(r.activated, r.newUsers)}</Td>
                  <Td className="text-right text-accent">{rate(r.surveyed, r.newUsers)}</Td>
                  <Td className="text-right">{r.ms ? formatDuration(r.ms) : "–"}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function EntryPages({ ctx }: { ctx: WidgetCtx }) {
  const rows = entryTable(ctx.data);
  const max = Math.max(1, ...rows.map((r) => r.sessions));
  return (
    <Panel title="Páginas de entrada" subtitle="Onde as sessões começam.">
      {!rows.length ? (
        <Empty />
      ) : (
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[420px]">
            <thead>
              <tr>
                <Th>Página</Th>
                <Th className="w-[16%]" />
                <Th className="text-right">Visitas</Th>
                <Th className="text-right">Novos usuários</Th>
                <Th className="text-right">Ativação</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.path}>
                  <Td className="max-w-[180px]">
                    <span className="flex items-center gap-2 truncate font-medium text-fg-soft">
                      <LogIn className="size-3.5 shrink-0 text-fg-mut" />
                      <span className="truncate">{pagePath("", r.path, false)}</span>
                    </span>
                  </Td>
                  <Td className="pr-4">
                    <MiniBar value={r.sessions} max={max} />
                  </Td>
                  <Td className="text-right">{fmtInt(r.sessions)}</Td>
                  <Td className="text-right">{fmtInt(r.newUsers)}</Td>
                  <Td className="text-right text-accent">{r.activation === null ? "–" : fmtPct(r.activation)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function ExitPages({ ctx }: { ctx: WidgetCtx }) {
  const rows = ctx.data.exit ?? [];
  const pv = new Map((ctx.data.pages ?? []).map((p) => [p.path, (ctx.data.pages ?? []).filter((x) => x.path === p.path).reduce((a, x) => a + x.pv, 0)]));
  const max = Math.max(1, ...rows.map((r) => r.exits));
  return (
    <Panel title="Páginas de saída" subtitle="A última tela vista na sessão.">
      {!rows.length ? (
        <Empty />
      ) : (
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[380px]">
            <thead>
              <tr>
                <Th>Página</Th>
                <Th className="w-[18%]" />
                <Th className="text-right">Saídas</Th>
                <Th className="text-right">Taxa de saída</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const views = pv.get(r.path);
                return (
                  <tr key={r.path}>
                    <Td className="max-w-[200px]">
                      <span className="truncate font-medium text-fg-soft">{pagePath("", r.path, false)}</span>
                    </Td>
                    <Td className="pr-4">
                      <MiniBar value={r.exits} max={max} color="#F59E0B" />
                    </Td>
                    <Td className="text-right">{fmtInt(r.exits)}</Td>
                    <Td className="text-right" >{views ? fmtPct(Math.min(1, r.exits / views)) : "–"}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function AcquisitionFunnel({ ctx }: { ctx: WidgetCtx }) {
  const t = ctx.data.totals;
  const c = ctx.data.configured ?? {};
  const visitors = t?.users ?? 0;
  const steps = [
    { label: "Visitantes", n: visitors },
    { label: "Identificados", n: t?.identified ?? 0, hint: "Usuários informados com Luumu.identify (logados)." },
    { label: "Ativados", n: ctx.settings.activationEvent ? c.act ?? 0 : c.any_event ?? 0, hint: ctx.settings.activationEvent ? `Fizeram ${eventLabel(ctx.settings.activationEvent)}.` : "Fizeram alguma ação além de ver telas." },
    { label: "Responderam pesquisa", n: c.surveyed ?? 0 },
  ];
  return (
    <Panel title="Conversão no funil de aquisição" subtitle="Da primeira visita até a primeira resposta de pesquisa, no período.">
      {!visitors ? (
        <Empty />
      ) : (
        <div className="grid flex-1 grid-cols-2 content-center items-end gap-3 md:grid-cols-4">
          {steps.map((s, i) => {
            const pct = visitors ? s.n / visitors : 0;
            return (
              <div key={s.label} className="flex flex-col" title={s.hint}>
                <span className="text-center text-[13px] text-fg-soft">{s.label}</span>
                <span className="mt-0.5 text-center font-display text-[22px] font-extrabold tabular-nums text-accent">{fmtInt(s.n)}</span>
                <div className="relative mt-2 h-9 overflow-hidden rounded-lg bg-surface-brand/60">
                  <div className="h-full rounded-lg" style={{ width: `${Math.max(4, pct * 100)}%`, background: PURPLES[i] }} />
                  <span className={cn("absolute inset-0 grid place-items-center text-xs font-bold", pct > 0.5 ? "text-white" : "text-accent")}>{fmtPct(pct)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function Campaigns({ ctx }: { ctx: WidgetCtx }) {
  const rows = campaignTable(ctx.data);
  return (
    <Panel title="Novos usuários por campanha" subtitle="Sessões com utm_campaign na URL de entrada.">
      {!rows.length ? (
        <Empty text="Nenhuma campanha com UTM neste recorte. Use utm_campaign nos seus links para vê-las aqui." />
      ) : (
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[420px]">
            <thead>
              <tr>
                <Th>Campanha</Th>
                <Th>Canal</Th>
                <Th className="text-right">Novos usuários</Th>
                <Th className="text-right">Sessões</Th>
                <Th className="text-right">Ativação</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.campaign + r.channel}>
                  <Td className="max-w-[180px]">
                    <span className="truncate font-medium text-fg-soft">{r.campaign}</span>
                  </Td>
                  <Td>{CHANNEL_LABEL[r.channel] ?? r.channel}</Td>
                  <Td className="text-right">{fmtInt(r.newUsers)}</Td>
                  <Td className="text-right">{fmtInt(r.sessions)}</Td>
                  <Td className="text-right">{r.activation === null ? "–" : fmtPct(r.activation)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function EngagementTrend({ ctx }: { ctx: WidgetCtx }) {
  const [g, setG] = useState<"day" | "week">("day");
  const daily = (ctx.data.daily?.cur ?? []).map((x) => ({ d: x.d, dau: x.users, min: x.ms / 60000, spu: x.users ? x.sessions / x.users : 0 }));
  const rows = g === "week" ? weekly(daily, ["dau", "min", "spu"]) : daily;
  return (
    <Panel
      title="Evolução do engajamento"
      subtitle="Usuários ativos, tempo de uso e sessões ao longo do tempo."
      action={
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Legend items={[{ label: "DAU", color: "#6B2BD9" }, { label: "Tempo médio de uso", color: "#F59E0B" }, { label: "Sessões por usuário", color: "#3B82F6" }]} />
          <Granularity value={g} onChange={setG} />
        </div>
      }
    >
      {rows.length < 2 ? (
        <Empty text="Ainda há poucos dias de dados." />
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={rows} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="d" tickFormatter={shortDay} tick={axis} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis yAxisId="u" tick={axis} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => fmtInt(v)} />
            <YAxis yAxisId="m" orientation="right" tick={axis} axisLine={false} tickLine={false} width={36} tickFormatter={(v) => `${Math.round(v)}m`} />
            <YAxis yAxisId="s" hide domain={[0, "dataMax + 1"]} />
            <Tooltip
              content={
                <ChartTip
                  fmt={(v, k) => (k === "min" ? formatDuration(v * 60000) : k === "spu" ? fmtDec(v) : fmtInt(v))}
                />
              }
            />
            <Line yAxisId="u" type="monotone" name="DAU" dataKey="dau" stroke="#6B2BD9" strokeWidth={2.5} dot={{ r: 2.5, strokeWidth: 0, fill: "#6B2BD9" }} />
            <Line yAxisId="m" type="monotone" name="Tempo médio de uso" dataKey="min" stroke="#F59E0B" strokeWidth={2.5} dot={{ r: 2.5, strokeWidth: 0, fill: "#F59E0B" }} />
            <Line yAxisId="s" type="monotone" name="Sessões por usuário" dataKey="spu" stroke="#3B82F6" strokeWidth={2.5} dot={{ r: 2.5, strokeWidth: 0, fill: "#3B82F6" }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </Panel>
  );
}

function FrequencyDonut({ ctx }: { ctx: WidgetCtx }) {
  const f = ctx.data.frequency;
  const total = f ? Object.values(f).reduce((a, x) => a + x, 0) : 0;
  const colors: Record<Frequency, string> = { daily: "#6B2BD9", weekly: "#3B82F6", monthly: "#A78BFA", sporadic: "#DDD6FE" };
  return (
    <Panel title="Usuários por frequência de uso" subtitle="Dias com uso no período: diário (4+ por semana), semanal (1+ por semana), mensal ou esporádico (1 dia).">
      {!total || !f ? (
        <Empty />
      ) : (
        <Donut total={total} unit="usuários" items={(Object.keys(colors) as Frequency[]).map((k) => ({ label: FREQUENCY_LABEL[k], value: f[k], color: colors[k] }))} />
      )}
    </Panel>
  );
}

const DOW = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function Hours({ ctx }: { ctx: WidgetCtx }) {
  const { grid, norm } = hoursGrid(ctx.data);
  const empty = !grid.flat().some((v) => v > 0);
  return (
    <Panel title="Horários de maior engajamento" subtitle="Usuários ativos por dia da semana e hora (horário de Brasília).">
      {empty ? (
        <Empty />
      ) : (
        <div className="flex gap-3">
          <div className="min-w-0 flex-1 overflow-x-auto">
            <div className="grid min-w-[440px] grid-cols-[32px_repeat(24,minmax(0,1fr))] gap-[3px]">
              {norm.map((row, r) => (
                <div key={r} className="contents">
                  <span className="self-center text-[10px] text-fg-mut">{DOW[r]}</span>
                  {row.map((v, h) => (
                    <span
                      key={h}
                      className="aspect-square rounded-[3px]"
                      style={{ background: v ? `rgba(107,43,217,${0.08 + v * 0.92})` : "var(--bg-sunken)" }}
                      title={`${DOW[r]}, ${String(h).padStart(2, "0")}h: ${fmtInt(grid[r][h])} usuários`}
                    />
                  ))}
                </div>
              ))}
              <span />
              {Array.from({ length: 24 }, (_, h) => (
                <span key={h} className="text-center text-[9px] text-fg-mut">
                  {h % 3 === 0 ? `${String(h).padStart(2, "0")}h` : ""}
                </span>
              ))}
            </div>
          </div>
          <div className="hidden flex-col items-center justify-between py-1 text-[10px] text-fg-mut sm:flex">
            <span>Mais</span>
            <span className="w-2.5 flex-1 rounded-full" style={{ background: "linear-gradient(180deg, #6B2BD9, rgba(107,43,217,.08))" }} />
            <span>Menos</span>
          </div>
        </div>
      )}
    </Panel>
  );
}

function DeviceTime({ ctx }: { ctx: WidgetCtx }) {
  const rows = ctx.data.devices ?? [];
  const max = Math.max(1, ...rows.map((r) => r.ms));
  return (
    <Panel title="Tempo médio de sessão por dispositivo">
      {!rows.length ? (
        <Empty />
      ) : (
        <ul className="flex flex-1 flex-col justify-center gap-4">
          {rows.map((r) => {
            const Icon = DEVICE_ICON[r.device] ?? Monitor;
            return (
              <li key={r.device} className="grid grid-cols-[22px_70px_1fr_64px] items-center gap-2.5 text-sm">
                <Icon className="size-4 text-fg-mut" />
                <span className="text-fg-soft">{DEVICE_NAME[r.device] ?? r.device}</span>
                <MiniBar value={r.ms} max={max} color={DEVICE_COLOR[r.device]} />
                <span className="text-right font-semibold tabular-nums">{formatDuration(r.ms)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function RankList({ title, subtitle, items }: { title: string; subtitle?: string; items: { name: string; users: number }[] }) {
  const total = items.reduce((a, x) => a + x.users, 0);
  const max = Math.max(1, ...items.map((x) => x.users));
  return (
    <Panel title={title} subtitle={subtitle}>
      {!items.length ? (
        <Empty />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((x, i) => (
            <li key={x.name} className="grid grid-cols-[minmax(80px,1fr)_2fr_48px] items-center gap-3 text-sm">
              <span className="truncate text-fg-soft">{x.name}</span>
              <MiniBar value={x.users} max={max} color={PURPLES[Math.min(i, 5)]} />
              <span className="text-right font-semibold tabular-nums">{total ? fmtPct(x.users / total) : "–"}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function DeviceTrend({ ctx }: { ctx: WidgetCtx }) {
  const map = new Map<string, Record<string, number | string>>();
  for (const x of ctx.data.deviceTrend ?? []) {
    const r = map.get(x.d) ?? { d: x.d };
    r[x.device] = x.users;
    map.set(x.d, r);
  }
  const rows = [...map.values()];
  const devices = ["desktop", "mobile", "tablet"].filter((dv) => rows.some((r) => r[dv]));
  return (
    <Panel title="Usuários por dispositivo ao longo do tempo" action={<Legend items={devices.map((dv) => ({ label: DEVICE_NAME[dv], color: DEVICE_COLOR[dv] }))} />}>
      {rows.length < 2 ? (
        <Empty text="Ainda há poucos dias de dados." />
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={rows} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="d" tickFormatter={shortDay} tick={axis} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis tick={axis} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => fmtInt(v)} />
            <Tooltip content={<ChartTip />} />
            {devices.map((dv) => (
              <Area key={dv} type="monotone" stackId="1" name={DEVICE_NAME[dv]} dataKey={dv} stroke={DEVICE_COLOR[dv]} fill={DEVICE_COLOR[dv]} fillOpacity={0.4} strokeWidth={2} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Panel>
  );
}

function EventsTrend({ ctx }: { ctx: WidgetCtx }) {
  const names = [...new Set((ctx.data.eventTrend ?? []).map((x) => x.name))];
  const map = new Map<string, Record<string, number | string>>();
  for (const x of ctx.data.eventTrend ?? []) {
    const r = map.get(x.d) ?? { d: x.d };
    r[x.name] = x.users;
    map.set(x.d, r);
  }
  const rows = [...map.values()].sort((a, b) => String(a.d).localeCompare(String(b.d)));
  const colors = ["#6B2BD9", "#3B82F6", "#10B981", "#F59E0B", "#EC4899", "#94A3B8"];
  return (
    <Panel title="Tendência dos principais eventos" subtitle="Usuários únicos por dia que realizaram cada ação." action={<Legend items={names.map((n, i) => ({ label: eventLabel(n), color: colors[i] }))} />}>
      {rows.length < 2 ? (
        <Empty text="Ainda há poucos dias de dados." />
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={rows} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="d" tickFormatter={shortDay} tick={axis} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis tick={axis} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => fmtInt(v)} />
            <Tooltip content={<ChartTip />} />
            {names.map((n, i) => (
              <Line key={n} type="monotone" name={eventLabel(n)} dataKey={n} stroke={colors[i]} strokeWidth={2.2} dot={false} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </Panel>
  );
}

