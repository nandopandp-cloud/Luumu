"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "@/components/ui/Link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDownUp,
  ArrowRight,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  FileText,
  Layers,
  LogIn,
  Monitor,
  MousePointerClick,
  Search,
  Smartphone,
  Sparkles,
  Tablet,
  UserCheck,
  UserPlus,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserAvatar, displayName, secondaryLine } from "@/components/ui/UserIdentity";
import { Drawer } from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { InsightCard } from "@/components/ui/InsightCard";
import { SortTh } from "@/components/ui/SortableHeader";
import { CHANNEL_COLOR, CHANNEL_LABEL, eventLabel, fmtInt, formatDuration, type Channel } from "@/lib/analytics/core";
import { relativeTime } from "@/lib/search/core";
import type { AnalyticsUserProfile, UserRow } from "@/lib/db/analytics";
import { getUserProfileAction } from "@/app/(app)/analytics/actions";

export interface UsersData {
  rows: UserRow[];
  total: number;
  page: number;
  pages: number;
  kpis: { active: number; identified: number; newUsers: number; activePrev: number | null };
}

const DEVICE_ICON: Record<string, LucideIcon> = { desktop: Monitor, mobile: Smartphone, tablet: Tablet };
const DEVICE_NAME: Record<string, string> = { desktop: "Desktop", mobile: "Celular", tablet: "Tablet" };
const SEGMENTS = [
  { id: "all", label: "Todos" },
  { id: "identified", label: "Identificados" },
  { id: "anonymous", label: "Anônimos" },
  { id: "new", label: "Novos" },
  { id: "returning", label: "Recorrentes" },
] as const;

/** relógio do aparelho adiantado não pode virar "em 2 minutos" */
const past = (iso: string) => relativeTime(new Date(Math.min(Date.parse(iso), Date.now())).toISOString());
const pagePath = (p: string) => (p === "home" || !p ? "/" : `/${p.replace(/^\/+/, "")}`);
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" }).replace(".", "");
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).replace(".", "");

// colunas secundárias: somem quando a área é estreita (o perfil mostra tudo)
const WIDE = "hidden @[62rem]:table-cell";

function ChannelTag({ ch }: { ch: Channel }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-fg-soft">
      <span className="size-2 rounded-full" style={{ background: CHANNEL_COLOR[ch] ?? "#94A3B8" }} />
      {CHANNEL_LABEL[ch] ?? ch}
    </span>
  );
}

export function UsersView({ data }: { data: UsersData }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [open, setOpen] = useState<string | null>(null);
  const seg = sp.get("seg") ?? "all";
  const sort = sp.get("sort") ?? "recent";
  const dir = sp.get("dir") === "asc" ? "asc" : "desc";
  // cabeçalho clicado: mesma coluna inverte; outra coluna começa pelo sentido natural dela
  function onSort(k: string) {
    const nextDir = sort === k ? (dir === "asc" ? "desc" : "asc") : k === "name" ? "asc" : "desc";
    setParams({ sort: k === "recent" && nextDir === "desc" ? null : k, dir: nextDir === "desc" ? null : "asc", pg: null });
  }
  const sortState = { key: sort, dir: dir as "asc" | "desc" };
  const thBase = "border-b border-line pb-2 pl-3";

  function setParams(patch: Record<string, string | null>) {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
  }

  // busca com pausa: não navega a cada tecla
  useEffect(() => {
    const cur = sp.get("q") ?? "";
    if (q.trim() === cur) return;
    const t = window.setTimeout(() => setParams({ q: q.trim() || null, pg: null }), 350);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const k = data.kpis;
  const from = (data.page - 1) * 25 + 1;
  const to = Math.min(data.total, data.page * 25);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InsightCard
          label="Usuários ativos no período"
          value={fmtInt(k.active)}
          tone="roxo"
          icon={<Users className="size-5" />}
          series={[]}
          delta={k.activePrev ? { value: Math.round(((k.active - k.activePrev) / k.activePrev) * 1000) / 10, unit: "%" } : null}
        />
        <InsightCard
          label="Identificados"
          value={fmtInt(k.identified)}
          tone="azul"
          icon={<UserCheck className="size-5" />}
          series={[]}
          delta={null}
          hint="Usuários que o seu produto informou com Luumu.identify (logados)."
        />
        <InsightCard label="Novos" value={fmtInt(k.newUsers)} tone="verde" icon={<UserPlus className="size-5" />} series={[]} delta={null} hint="Primeira visita dentro do período." />
        <InsightCard
          label="Recorrentes"
          value={fmtInt(Math.max(0, k.active - k.newUsers))}
          tone="laranja"
          icon={<CalendarClock className="size-5" />}
          series={[]}
          delta={null}
          hint="Ativos no período que já tinham visitado antes dele."
        />
      </div>

      <section className="@container rounded-2xl border border-line bg-bg-elev p-5 shadow-[var(--shadow-sm)]">
        <div className="flex flex-wrap items-center gap-3">
          {/* área estreita (sidebar aberta): a busca ocupa a linha toda e os filtros descem */}
          <label className="flex min-w-[260px] flex-1 @max-[64rem]:basis-full items-center gap-2.5 rounded-xl border border-line-strong bg-bg px-3.5 py-2.5 transition focus-within:border-accent">
            <Search className="size-4 text-fg-mut" aria-hidden />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome, e-mail ou ID…"
              aria-label="Buscar usuários"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-fg-mut"
            />
          </label>
          <div role="tablist" aria-label="Segmento" className="flex flex-wrap gap-1 rounded-xl border border-line bg-bg p-1">
            {SEGMENTS.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={seg === s.id}
                onClick={() => setParams({ seg: s.id === "all" ? null : s.id, pg: null })}
                className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold transition", seg === s.id ? "bg-accent text-white" : "text-fg-mut hover:bg-bg-sunken hover:text-fg-soft")}
              >
                {s.label}
              </button>
            ))}
          </div>
          <Select
            value={`${sort}:${dir}`}
            onChange={(e) => {
              const [k, d] = e.target.value.split(":");
              setParams({ sort: k === "recent" && d === "desc" ? null : k, dir: d === "asc" ? "asc" : null, pg: null });
            }}
            aria-label="Ordenar"
            icon={<ArrowDownUp />}
            className="w-auto min-w-[220px] py-2 text-sm"
          >
            <option value="recent:desc">Atividade mais recente</option>
            <option value="recent:asc">Atividade mais antiga</option>
            <option value="sessions:desc">Mais sessões</option>
            <option value="time:desc">Mais tempo ativo</option>
            <option value="pages:desc">Mais telas vistas</option>
            <option value="days:desc">Mais dias ativos</option>
            <option value="first:asc">Primeira visita mais antiga</option>
            <option value="first:desc">Primeira visita mais recente</option>
            <option value="name:asc">Nome (A–Z)</option>
            <option value="name:desc">Nome (Z–A)</option>
          </Select>
        </div>

        {!data.rows.length ? (
          <div className="flex flex-col items-center py-16 text-center text-sm text-fg-mut">
            <Users className="mb-2 size-7 text-accent/60" />
            {q ? `Nenhum usuário encontrado para “${q}”.` : "Nenhum usuário neste recorte."}
          </div>
        ) : (
          <div className="-mx-1 mt-4 overflow-x-auto px-1">
            {/* números e datas numa linha só: em tela menor a tabela rola na horizontal em vez de quebrar "30m / 13s" */}
            <table className="w-full min-w-[760px] @[62rem]:min-w-[980px] [&_td]:whitespace-nowrap">
              <thead>
                <tr className="text-left font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-fg-mut">
                  <SortTh label="Usuário" k="name" sort={sortState} onSort={onSort} className="border-b border-line pb-2" />
                  <SortTh label="Última atividade" k="recent" sort={sortState} onSort={onSort} className={thBase} />
                  <SortTh label="Sessões" k="sessions" sort={sortState} onSort={onSort} align="right" className={`${thBase} text-right`} />
                  <SortTh label="Telas" k="pages" sort={sortState} onSort={onSort} align="right" className={`${thBase} text-right`} />
                  <SortTh label="Tempo ativo" k="time" sort={sortState} onSort={onSort} align="right" className={`${thBase} text-right`} />
                  <SortTh label="Dias ativos" k="days" sort={sortState} onSort={onSort} align="right" className={`${thBase} text-right`} />
                  <th className={`${thBase} ${WIDE} text-right`} title="Contadas só para esta página da lista">Ações</th>
                  <th className={`${thBase} ${WIDE}`}>Dispositivo</th>
                  <th className={thBase}>Origem</th>
                  <SortTh label="Primeira visita" k="first" sort={sortState} onSort={onSort} className={thBase} />
                </tr>
              </thead>
              <tbody>
                {data.rows.map((u) => {
                  const Dev = DEVICE_ICON[u.device] ?? Monitor;
                  const identified = !!(u.userId || u.email || u.name);
                  return (
                    <tr
                      key={u.anonId}
                      onClick={() => setOpen(u.anonId)}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setOpen(u.anonId))}
                      tabIndex={0}
                      className="group cursor-pointer outline-none transition hover:bg-surface-brand/30 focus-visible:bg-surface-brand/40"
                    >
                      <td className="border-b border-line/60 py-2.5 pr-3">
                        <span className="flex items-center gap-3">
                          <UserAvatar u={u} />
                          <span className="min-w-0">
                            <span className="flex items-center gap-1.5">
                              <span className="max-w-[240px] truncate text-sm font-semibold text-fg group-hover:text-accent">{displayName(u)}</span>
                              {!identified && <span className="rounded-full bg-bg-sunken px-1.5 py-px text-[10px] font-semibold text-fg-mut">anônimo</span>}
                            </span>
                            <span className="block max-w-[260px] truncate text-xs text-fg-mut">
                              {secondaryLine(u)}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="border-b border-line/60 py-2.5 pl-3 text-[13px] text-fg-soft" title={fmtDateTime(u.lastSeenAt)}>
                        {past(u.lastSeenAt)}
                      </td>
                      <td className="border-b border-line/60 py-2.5 pl-3 text-right text-[13px] tabular-nums">{fmtInt(u.sessions)}</td>
                      <td className="border-b border-line/60 py-2.5 pl-3 text-right text-[13px] tabular-nums">{fmtInt(u.pageviews)}</td>
                      <td className="border-b border-line/60 py-2.5 pl-3 text-right text-[13px] tabular-nums">{formatDuration(u.ms)}</td>
                      <td className="border-b border-line/60 py-2.5 pl-3 text-right text-[13px] tabular-nums">{fmtInt(u.days)}</td>
                      <td className={`border-b border-line/60 py-2.5 pl-3 text-right text-[13px] tabular-nums ${WIDE}`}>{fmtInt(u.events)}</td>
                      <td className={`border-b border-line/60 py-2.5 pl-3 ${WIDE}`}>
                        <span className="inline-flex items-center gap-1.5 text-[13px] text-fg-soft" title={[u.os, u.browser].filter(Boolean).join(" · ")}>
                          <Dev className="size-3.5 text-fg-mut" /> {DEVICE_NAME[u.device] ?? u.device}
                        </span>
                      </td>
                      <td className="border-b border-line/60 py-2.5 pl-3">
                        <ChannelTag ch={u.channel} />
                      </td>
                      <td className="border-b border-line/60 py-2.5 pl-3 text-[13px] text-fg-soft">{fmtDate(u.firstSeenAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {data.total > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-fg-mut">
            <span>
              Mostrando <strong className="text-fg-soft">{fmtInt(from)}–{fmtInt(to)}</strong> de <strong className="text-fg-soft">{fmtInt(data.total)}</strong> usuários
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={data.page <= 1}
                onClick={() => setParams({ pg: data.page - 1 > 1 ? String(data.page - 1) : null })}
                className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 font-semibold text-fg-soft transition hover:border-accent hover:text-accent disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronLeft className="size-4" /> Anterior
              </button>
              <span className="px-2 tabular-nums">
                {data.page} / {data.pages}
              </span>
              <button
                type="button"
                disabled={data.page >= data.pages}
                onClick={() => setParams({ pg: String(data.page + 1) })}
                className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 font-semibold text-fg-soft transition hover:border-accent hover:text-accent disabled:pointer-events-none disabled:opacity-40"
              >
                Próxima <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        )}
      </section>

      {open && <UserProfileDrawer anonId={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/* ---------- perfil ---------- */

function UserProfileDrawer({ anonId, onClose }: { anonId: string; onClose: () => void }) {
  const [p, setP] = useState<AnalyticsUserProfile | null | "loading">("loading");
  useEffect(() => {
    let alive = true;
    getUserProfileAction(anonId)
      .then((r) => alive && setP(r))
      .catch(() => alive && setP(null));
    return () => {
      alive = false;
    };
  }, [anonId]);

  return (
    <Drawer title="Perfil do usuário" subtitle="Tudo o que esta pessoa fez no seu produto." onClose={onClose} wide>
      {p === "loading" ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <div className="h-20 animate-pulse rounded-2xl bg-bg-sunken" />
          <div className="h-24 animate-pulse rounded-2xl bg-bg-sunken" />
          <div className="h-60 animate-pulse rounded-2xl bg-bg-sunken" />
        </div>
      ) : !p ? (
        <p className="py-10 text-center text-sm text-fg-mut">Não foi possível carregar este usuário.</p>
      ) : (
        <Profile p={p} />
      )}
    </Drawer>
  );
}

function Copyable({ label, value }: { label: string; value: string }) {
  const toast = useToast();
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(value).then(() => toast("success", `${label} copiado.`))}
      className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-bg-sunken px-2 py-1 text-left font-mono text-[11px] text-fg-soft transition hover:text-accent"
      title={`Copiar ${label.toLowerCase()}`}
    >
      <span className="shrink-0 font-sans font-semibold text-fg-mut">{label}</span>
      <span className="truncate">{value}</span>
      <Copy className="size-3 shrink-0" />
    </button>
  );
}

function Stat({ icon: Icon, value, label }: { icon: LucideIcon; value: string; label: string }) {
  return (
    <div className="rounded-xl border border-line p-3">
      <Icon className="size-4 text-accent" />
      <div className="mt-1.5 font-display text-xl font-extrabold leading-none tabular-nums">{value}</div>
      <div className="mt-1 text-[11px] text-fg-mut">{label}</div>
    </div>
  );
}

/** 90 dias de atividade em quadradinhos (semana × dia), como um calendário de contribuições. */
function ActivityGrid({ activity }: { activity: AnalyticsUserProfile["activity"] }) {
  const days = useMemo(() => {
    const map = new Map(activity.map((a) => [a.d, a]));
    const out: { d: string; v: number }[] = [];
    const today = new Date();
    for (let i = 90; i >= 0; i--) {
      const dt = new Date(today.getTime() - i * 86_400_000);
      const d = dt.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      out.push({ d, v: map.get(d)?.ms ?? 0 });
    }
    return out;
  }, [activity]);
  const max = Math.max(1, ...days.map((x) => x.v));
  const active = days.filter((x) => x.v > 0).length;
  return (
    <div>
      <div className="grid w-fit grid-flow-col grid-rows-7 gap-[3px]" style={{ gridAutoColumns: "12px" }}>
        {days.map((x) => (
          <span
            key={x.d}
            className="size-3 rounded-[3px]"
            style={{ background: x.v ? `rgba(107,43,217,${0.2 + (x.v / max) * 0.8})` : "var(--bg-sunken)" }}
            title={`${x.d.split("-").reverse().join("/")}: ${x.v ? formatDuration(x.v) + " de uso" : "sem uso"}`}
          />
        ))}
      </div>
      <p className="mt-2 text-xs text-fg-mut">
        Usou o produto em <strong className="text-fg-soft">{active}</strong> dos últimos 90 dias.
      </p>
    </div>
  );
}

function Section({ title, icon: Icon, children, aside }: { title: string; icon: LucideIcon; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-display text-[15px] font-bold">
          <Icon className="size-4 text-accent" /> {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

const SENT = { positivo: "bg-sucesso/12 text-sucesso", neutro: "bg-aviso/15 text-aviso", negativo: "bg-erro/10 text-erro" } as Record<string, string>;

export function Profile({ p }: { p: AnalyticsUserProfile }) {
  const [openSession, setOpenSession] = useState<string | null>(p.sessions[0]?.id ?? null);
  const identified = !!(p.userId || p.email || p.name);
  return (
    <div>
      {/* quem é */}
      <div className="flex items-start gap-4">
        <UserAvatar u={p} size={56} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-display text-xl font-extrabold tracking-tight">{displayName(p)}</h3>
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", identified ? "bg-sec-azul/10 text-sec-azul" : "bg-bg-sunken text-fg-mut")}>
              {identified ? "Identificado" : "Anônimo"}
            </span>
          </div>
          {p.name && p.email && <p className="truncate text-sm text-fg-mut">{p.email}</p>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {p.userId && <Copyable label="ID do produto" value={p.userId} />}
            <Copyable label="ID anônimo" value={p.anonId} />
          </div>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-bg-sunken/60 p-4 text-sm">
        <dt className="text-fg-mut">Primeira visita</dt>
        <dd className="text-right font-semibold">{fmtDateTime(p.firstSeenAt)}</dd>
        <dt className="text-fg-mut">Última atividade</dt>
        <dd className="text-right font-semibold">{past(p.lastSeenAt)}</dd>
        <dt className="text-fg-mut">Chegou por</dt>
        <dd className="flex justify-end">
          <span className="flex items-center gap-2">
            <ChannelTag ch={p.channel} />
            {p.campaign && <span className="truncate text-xs text-fg-mut">· {p.campaign}</span>}
          </span>
        </dd>
        <dt className="text-fg-mut">Página de entrada</dt>
        <dd className="truncate text-right font-semibold">{pagePath(p.landing)}</dd>
      </dl>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat icon={Layers} value={fmtInt(p.totals.sessions)} label="sessões" />
        <Stat icon={FileText} value={fmtInt(p.totals.pageviews)} label="telas vistas" />
        <Stat icon={Clock} value={formatDuration(p.totals.ms)} label="tempo ativo" />
        <Stat icon={CalendarClock} value={fmtInt(p.totals.days)} label="dias com uso" />
      </div>

      <Section title="Atividade" icon={Zap}>
        <ActivityGrid activity={p.activity} />
      </Section>

      <Section title="Respostas de pesquisa" icon={Sparkles}>
        {!p.userId ? (
          <p className="rounded-xl bg-bg-sunken/60 p-3 text-xs text-fg-mut">
            Visitante anônimo: as respostas só são ligadas ao usuário quando o produto informa quem ele é com Luumu.identify.
          </p>
        ) : !p.responses.length ? (
          <p className="text-sm text-fg-mut">Ainda não respondeu nenhuma pesquisa.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {p.responses.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/responses?surveyId=${r.surveyId}`}
                  className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-2.5 transition hover:border-accent/40 hover:bg-surface-brand/30"
                >
                  <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg font-display text-sm font-extrabold", SENT[r.sentiment ?? ""] ?? "bg-bg-sunken text-fg-soft")}>
                    {r.score === null ? "–" : Number.isInteger(r.score) ? r.score : r.score.toFixed(1).replace(".", ",")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{r.survey}</span>
                    <span className="text-xs text-fg-mut">{fmtDateTime(r.at)}</span>
                  </span>
                  <ArrowRight className="size-4 text-fg-mut" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div className="grid gap-x-6 sm:grid-cols-2">
        <Section title="Ações mais realizadas" icon={MousePointerClick}>
          {!p.topEvents.length ? (
            <p className="text-sm text-fg-mut">Nenhuma ação registrada.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {p.topEvents.map((e) => (
                <li key={e.name} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-fg-soft" title={e.name}>
                    {eventLabel(e.name)}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">{fmtInt(e.n)}×</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Telas mais vistas" icon={FileText}>
          {!p.topPages.length ? (
            <p className="text-sm text-fg-mut">Nenhuma tela registrada.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {p.topPages.map((x) => (
                <li key={x.path} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-fg-soft">{pagePath(x.path)}</span>
                  <span className="shrink-0 font-semibold tabular-nums">{fmtInt(x.n)}×</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title="Linha do tempo" icon={CalendarClock} aside={<span className="text-xs text-fg-mut">últimas {p.sessions.length} sessões</span>}>
        <ol className="relative flex flex-col gap-2 border-l-2 border-line pl-4">
          {p.sessions.map((s) => {
            const Dev = DEVICE_ICON[s.device] ?? Monitor;
            const open = openSession === s.id;
            return (
              <li key={s.id} className="relative">
                <span className="absolute -left-[23px] top-3.5 size-3 rounded-full border-2 border-bg-elev bg-accent" aria-hidden />
                <button
                  type="button"
                  onClick={() => setOpenSession(open ? null : s.id)}
                  aria-expanded={open}
                  className={cn("w-full rounded-xl border px-3.5 py-2.5 text-left transition", open ? "border-accent/40 bg-surface-brand/30" : "border-line hover:border-accent/30")}
                >
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{fmtDateTime(s.startedAt)}</span>
                    <span className="flex items-center gap-3 text-xs text-fg-mut">
                      <span className="inline-flex items-center gap-1">
                        <Dev className="size-3.5" /> {[s.os, s.browser].filter((x) => x && x !== "Outro").join(" · ") || DEVICE_NAME[s.device]}
                      </span>
                      <span>{fmtInt(s.pageviews)} telas</span>
                      <span>{formatDuration(s.ms)}</span>
                    </span>
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-fg-mut">
                    <ChannelTag ch={s.channel} />
                    {s.referrer && <span>via {s.referrer}</span>}
                    {s.campaign && <span>· campanha {s.campaign}</span>}
                  </span>
                </button>
                {open && (
                  <ol className="mt-2 flex flex-col gap-1.5 pl-2">
                    {!s.pages.length && <li className="text-xs text-fg-mut">Telas desta sessão não estão mais disponíveis.</li>}
                    {s.pages.map((pg, i) => (
                      <li key={i} className="rounded-lg bg-bg-sunken/50 px-3 py-2">
                        <span className="flex items-center justify-between gap-2 text-[13px]">
                          <span className="flex min-w-0 items-center gap-2 font-medium">
                            {i === 0 ? <LogIn className="size-3.5 shrink-0 text-accent" /> : <FileText className="size-3.5 shrink-0 text-fg-mut" />}
                            <span className="truncate">{pagePath(pg.path)}</span>
                          </span>
                          <span className="shrink-0 text-xs text-fg-mut">
                            {new Date(pg.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })} · {formatDuration(pg.ms)}
                          </span>
                        </span>
                        {pg.events.length > 0 && (
                          <span className="mt-1.5 flex flex-wrap gap-1">
                            {pg.events.slice(0, 8).map((e) => (
                              <span key={e} className="rounded-full bg-surface-brand px-2 py-0.5 text-[11px] font-medium text-accent" title={e}>
                                {eventLabel(e)}
                              </span>
                            ))}
                            {pg.events.length > 8 && <span className="text-[11px] text-fg-mut">+{pg.events.length - 8}</span>}
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            );
          })}
        </ol>
      </Section>
    </div>
  );
}

