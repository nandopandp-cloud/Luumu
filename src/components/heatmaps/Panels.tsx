"use client";

import { useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp, Clock, Layers, MousePointerClick, Timer, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { depthMilestones, formatDuration, pctChange, splitPath, type SectionStat } from "@/lib/heatmaps/core";
import { kindOfSelector } from "@/lib/heatmaps/draw";
import type { HeatmapReport } from "@/lib/db/heatmaps";

const pct = (v: number) => `${Math.round(v * 100)}%`;
const fmt = (n: number) => n.toLocaleString("pt-BR");

export function Card({ title, subtitle, children, className, action }: { title: string; subtitle?: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <section className={cn("flex flex-col rounded-2xl border border-line bg-bg-elev p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-[17px] font-bold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-fg-mut">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4 flex flex-1 flex-col">{children}</div>
    </section>
  );
}

function Rank({ n }: { n: number }) {
  return <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-brand text-sm font-bold text-accent">{n}</span>;
}

function Bar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-2 overflow-hidden rounded-full bg-bg-sunken", className)}>
      <div className="h-full rounded-full [background:var(--grad-roxo)] transition-[width] duration-700" style={{ width: `${Math.max(2, Math.min(100, value * 100))}%` }} />
    </div>
  );
}

function Delta({ value, unit = "%", invert = false }: { value: number | null; unit?: string; invert?: boolean }) {
  if (value === null || !Number.isFinite(value)) return <span className="text-xs text-fg-mut">sem período anterior</span>;
  const good = invert ? value < 0 : value > 0;
  const Icon = value > 0 ? ArrowUp : value < 0 ? ArrowDown : ArrowRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-sm font-bold", value === 0 ? "text-fg-mut" : good ? "text-sucesso" : "text-erro")}>
      <Icon className="size-3.5" />
      {Math.abs(value)}
      {unit}
    </span>
  );
}

const ViewAll = ({ open, onClick, label }: { open: boolean; onClick: () => void; label: string }) => (
  <button
    type="button"
    onClick={onClick}
    className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-surface-brand/70 py-2.5 text-sm font-semibold text-accent transition hover:bg-surface-brand"
  >
    {open ? "Ver menos" : label} <ArrowRight className={cn("size-4 transition-transform", open && "-rotate-90")} />
  </button>
);

/* ---------- miniatura do elemento ---------- */

function Thumb({ sel, label }: { sel: string; label: string }) {
  const kind = kindOfSelector(sel);
  const text = label || kind;
  return (
    <span className="grid h-14 w-24 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-bg px-2" aria-hidden>
      {kind === "Botão" ? (
        <span className="max-w-full truncate rounded-md px-2 py-1 text-[9px] font-bold text-white [background:var(--grad-roxo)]">{text}</span>
      ) : kind === "Link" ? (
        <span className="max-w-full truncate text-[10px] font-semibold text-accent underline decoration-accent/40">{text}</span>
      ) : kind === "Campo" ? (
        <span className="w-full truncate rounded border border-line-strong px-1.5 py-1 text-[9px] text-fg-mut">{text}</span>
      ) : kind === "Título" ? (
        <span className="line-clamp-2 text-center text-[9px] font-extrabold leading-tight text-fg">{text}</span>
      ) : (
        <span className="line-clamp-2 text-center text-[9px] text-fg-soft">{text}</span>
      )}
    </span>
  );
}

export const elementName = (sel: string, label: string) => {
  const kind = kindOfSelector(sel);
  return label ? (kind === "Elemento" || kind === "Texto" ? label : `${kind} ${label}`) : `${kind} sem rótulo`;
};

/* ---------- cliques ---------- */

export function TopClickAreas({
  report,
  compare,
  highlight,
  onHighlight,
}: {
  report: HeatmapReport;
  compare: boolean;
  highlight: string | null;
  onHighlight: (sel: string | null) => void;
}) {
  const [all, setAll] = useState(false);
  const items = report.elements.slice(0, all ? 15 : 5);
  return (
    <Card title="Principais áreas de clique" subtitle="Elementos mais clicados na página. Clique para ver no mapa.">
      {!items.length && <Empty icon={MousePointerClick} text="Nenhum clique registrado neste recorte." />}
      <ul className="flex flex-col divide-y divide-line">
        {items.map((e, i) => {
          const delta = compare && e.prevShare !== null ? Math.round((e.share - e.prevShare) * 100) : null;
          return (
            <li key={e.s}>
              <button
                type="button"
                onClick={() => onHighlight(highlight === e.s ? null : e.s)}
                aria-pressed={highlight === e.s}
                className={cn("flex w-full items-center gap-3 rounded-xl px-1 py-3 text-left transition hover:bg-bg-sunken/60", highlight === e.s && "bg-surface-brand/60")}
              >
                <Rank n={i + 1} />
                <Thumb sel={e.s} label={e.label} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-fg">{elementName(e.s, e.label)}</span>
                  <span className="text-xs text-fg-mut">{fmt(e.clicks)} cliques</span>
                </span>
                <span className="flex flex-col items-end">
                  <span className="text-sm font-bold tabular-nums">{pct(e.share)}</span>
                  {delta !== null && (
                    <span className={cn("text-[11px] font-bold", delta > 0 ? "text-sucesso" : delta < 0 ? "text-erro" : "text-fg-mut")}>
                      {delta > 0 ? "+" : ""}
                      {delta} p.p.
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {report.elements.length > 5 && <ViewAll open={all} onClick={() => setAll((v) => !v)} label="Ver todos os elementos" />}
    </Card>
  );
}

export function DevicesCard({ report }: { report: HeatmapReport }) {
  const total = report.devices.reduce((a, d) => a + d.n, 0);
  const order = ["desktop", "mobile", "tablet"] as const;
  const colors = { desktop: "#6B2BD9", mobile: "#A78BFA", tablet: "#DDD0FF" };
  const names = { desktop: "Desktop", mobile: "Mobile", tablet: "Tablet" };
  const rows = order.map((d) => ({ d, n: report.devices.find((x) => x.device === d)?.n ?? 0 }));
  const R = 54;
  const C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <Card title="Dispositivos">
      <div className="flex flex-1 items-center gap-6">
        <div className="relative size-[148px] shrink-0">
          <svg viewBox="0 0 140 140" className="size-full -rotate-90">
            <circle cx="70" cy="70" r={R} fill="none" stroke="var(--bg-sunken)" strokeWidth="18" />
            {total > 0 &&
              rows.map(({ d, n }) => {
                const len = (n / total) * C;
                const el = (
                  <circle key={d} cx="70" cy="70" r={R} fill="none" stroke={colors[d]} strokeWidth="18" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} />
                );
                acc += len;
                return el;
              })}
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="font-display text-xl font-extrabold tabular-nums">{fmt(total)}</div>
              <div className="text-xs text-fg-mut">visitas</div>
            </div>
          </div>
        </div>
        <ul className="flex flex-1 flex-col gap-3">
          {rows.map(({ d, n }) => (
            <li key={d} className="flex items-center gap-2.5 text-sm">
              <span className="size-2.5 rounded-full" style={{ background: colors[d] }} />
              <span className="flex-1 text-fg-soft">{names[d]}</span>
              <span className="font-bold tabular-nums">{total ? pct(n / total) : "0%"}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

export function ScrollDepthBars({ curve }: { curve: number[] }) {
  return (
    <Card title="Profundidade de scroll" subtitle="Até onde os usuários chegam na página.">
      <ul className="flex flex-col gap-3.5">
        {[25, 50, 75, 100].map((p) => (
          <li key={p} className="grid grid-cols-[42px_1fr_42px] items-center gap-3 text-sm">
            <span className="text-fg-mut">{p}%</span>
            <Bar value={curve[p] ?? 0} />
            <span className="text-right font-semibold tabular-nums">{pct(curve[p] ?? 0)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <div className="h-16" />;
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const W = 220;
  const H = 70;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * W, H - 8 - ((v - min) / (max - min || 1)) * (H - 16)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[70px] w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="hm-spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8B5CF6" stopOpacity=".35" />
          <stop offset="1" stopColor="#8B5CF6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${W},${H} L0,${H} Z`} fill="url(#hm-spark)" />
      <path d={d} fill="none" stroke="#7C3AED" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {pts.map(([x, y], i) => (i === pts.length - 1 ? <circle key={i} cx={x} cy={y} r="4" fill="#7C3AED" /> : null))}
    </svg>
  );
}

export function TimeOnPage({ report }: { report: HeatmapReport }) {
  const change = report.prev ? pctChange(report.avgDurationMs, report.prev.avgDurationMs) : null;
  return (
    <Card
      title="Tempo na página"
      action={
        <span className="grid size-10 place-items-center rounded-full bg-surface-brand text-accent">
          <Timer className="size-5" />
        </span>
      }
    >
      <div className="flex flex-1 items-end gap-4">
        <div className="shrink-0">
          <div className="font-display text-[34px] font-extrabold leading-none text-accent">{formatDuration(report.avgDurationMs)}</div>
          <div className="mt-2">
            <Delta value={change} />
          </div>
          {change !== null && <div className="text-xs text-fg-mut">vs. período anterior</div>}
          <div className="mt-1 text-[11px] text-fg-mut">tempo ativo médio</div>
        </div>
        <div className="min-w-0 flex-1">
          <Sparkline values={report.daily.map((d) => d.ms)} />
        </div>
      </div>
    </Card>
  );
}

/* ---------- movimento ---------- */

export function TopPaths({ report }: { report: HeatmapReport }) {
  const [all, setAll] = useState(false);
  const items = report.paths.slice(0, all ? 8 : 5);
  const name = (s: string) => {
    const l = report.labels[s] ?? "";
    return l || kindOfSelector(s);
  };
  return (
    <Card title="Principais caminhos" subtitle="Sequência de elementos mais recorrente.">
      {!items.length && <Empty icon={Layers} text="Ainda não há visitas com dois ou mais cliques nesta página." />}
      <ul className="flex flex-col divide-y divide-line">
        {items.map((p, i) => (
          <li key={p.key} className="flex items-center gap-3 py-3.5">
            <Rank n={i + 1} />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1 text-sm font-semibold text-fg">
                {splitPath(p.key).map((s, j, arr) => (
                  <span key={j} className="inline-flex items-center gap-1">
                    <span className="max-w-[140px] truncate">{name(s)}</span>
                    {j < arr.length - 1 && <ArrowRight className="size-3.5 text-fg-mut" />}
                  </span>
                ))}
              </span>
              <span className="text-xs text-fg-mut">{fmt(p.n)} visitas</span>
            </span>
            <span className="text-sm font-bold tabular-nums">{report.pageviews ? pct(p.n / report.pageviews) : "0%"}</span>
          </li>
        ))}
      </ul>
      {report.paths.length > 5 && <ViewAll open={all} onClick={() => setAll((v) => !v)} label="Ver todos os caminhos" />}
    </Card>
  );
}

export function HoverElements({ report, onHighlight }: { report: HeatmapReport; onHighlight: (s: string) => void }) {
  const items = report.hovers.slice(0, 5);
  return (
    <Card title="Elementos mais visitados" subtitle="Com base no movimento do cursor.">
      {!items.length && <Empty icon={MousePointerClick} text="Sem movimento de cursor registrado (visitas em celular não têm cursor)." />}
      <ul className="flex flex-col gap-2.5">
        {items.map((h, i) => (
          <li key={h.s}>
            <button type="button" onClick={() => onHighlight(h.s)} className="grid w-full grid-cols-[28px_minmax(0,1fr)_minmax(60px,140px)_40px] items-center gap-3 rounded-lg text-left hover:bg-bg-sunken/60">
              <span className="grid size-7 place-items-center rounded-full bg-surface-brand text-xs font-bold text-accent">{i + 1}</span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold">{elementName(h.s, h.label)}</span>
                <span className="text-[11px] text-fg-mut">
                  {fmt(h.visits)} visitas · {formatDuration(h.ms / Math.max(1, h.visits))} em média
                </span>
              </span>
              <Bar value={report.pageviews ? h.visits / report.pageviews : 0} />
              <span className="text-right text-sm font-semibold tabular-nums">{report.pageviews ? pct(h.visits / report.pageviews) : "0%"}</span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function MoveDepth({ moveCurve }: { moveCurve: number[] }) {
  const marks = [25, 50, 75, 100];
  return (
    <Card title="Profundidade de movimento" subtitle="Até onde os usuários levam o cursor na página.">
      <div className="flex gap-4">
        <div className="relative w-16 shrink-0 overflow-hidden rounded-lg border border-line" aria-hidden>
          <div
            className="h-full w-full"
            style={{
              background: `linear-gradient(180deg, ${marks.map((m) => `rgba(${Math.round(255 * (moveCurve[m] ?? 0))},${Math.round(80 + 140 * (1 - Math.abs((moveCurve[m] ?? 0) - 0.5) * 2))},${Math.round(255 * (1 - (moveCurve[m] ?? 0)))},.75) ${m - 12}%`).join(",")})`,
            }}
          />
        </div>
        <ul className="flex flex-1 flex-col justify-between gap-3">
          {marks.map((m) => (
            <li key={m} className="grid grid-cols-[42px_1fr_40px] items-center gap-3 text-sm">
              <span className="text-fg-mut">{m}%</span>
              <Bar value={moveCurve[m] ?? 0} />
              <span className="text-right font-semibold tabular-nums">{pct(moveCurve[m] ?? 0)}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

/* ---------- scroll ---------- */

export function ScrollDepthPanel({ curve, total }: { curve: number[]; total: number }) {
  const rows = [{ depth: 0, reach: 1, sessions: total }, ...depthMilestones(curve, total)];
  return (
    <Card title="Profundidade de scroll" subtitle="Quantos usuários chegam em cada parte da página.">
      <ul className="flex flex-col divide-y divide-line">
        {rows.map((r) => (
          <li key={r.depth} className="grid grid-cols-[88px_88px_1fr] items-center gap-3 py-2.5">
            <span className="text-sm text-fg-soft">
              {r.depth}% {r.depth === 0 ? <span className="text-fg-mut">(Topo)</span> : r.depth === 100 ? <span className="text-fg-mut">(Final)</span> : null}
            </span>
            <span>
              <span className="block text-sm font-bold tabular-nums">{pct(r.reach)}</span>
              <span className="text-[11px] text-fg-mut">{fmt(r.sessions)} visitas</span>
            </span>
            <Bar value={r.reach} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function AbandonPanel({ drops, ready }: { drops: SectionStat[]; ready: boolean }) {
  return (
    <Card title="Pontos de maior abandono">
      {!ready ? (
        <Empty icon={TrendingDown} text="As seções aparecem quando a imagem da página estiver disponível." />
      ) : !drops.length ? (
        <Empty icon={TrendingDown} text="Nenhuma seção perde mais de 3% do público. Ótimo sinal!" />
      ) : (
        <ul className="flex flex-col gap-3">
          {drops.map((d, i) => (
            <li key={d.label + i} className="flex items-center gap-3">
              <Rank n={i + 1} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{d.label}</span>
                <span className="text-xs text-fg-mut">Queda de {pct(d.drop)} dos usuários</span>
              </span>
              <span className="inline-flex items-center gap-0.5 text-sm font-bold text-erro">
                <ArrowDown className="size-3.5" /> {pct(d.drop)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function GeneralBehavior({ report }: { report: HeatmapReport }) {
  const pps = report.pagesPerSession;
  const items = [
    {
      icon: Clock,
      value: formatDuration(report.avgDurationMs),
      label: "Tempo médio na página",
      delta: report.prev ? pctChange(report.avgDurationMs, report.prev.avgDurationMs) : null,
    },
    {
      icon: Layers,
      value: pps.cur ? pps.cur.toFixed(1).replace(".", ",") : "–",
      label: "Páginas por sessão",
      delta: pps.prev ? pctChange(pps.cur, pps.prev) : null,
    },
    {
      icon: Timer,
      value: pct(report.scroll75),
      label: "Taxa de scroll até 75%",
      delta: report.prev ? Math.round((report.scroll75 - report.prev.scroll75) * 100) : null,
      unit: " p.p.",
    },
  ];
  return (
    <Card title="Comportamento geral">
      <div className="grid flex-1 gap-4 sm:grid-cols-3 sm:divide-x sm:divide-line">
        {items.map((it) => (
          <div key={it.label} className="flex items-start gap-3 sm:pl-4 sm:first:pl-0">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-brand text-accent">
              <it.icon className="size-5" />
            </span>
            <div>
              <div className="font-display text-2xl font-extrabold leading-tight tabular-nums">{it.value}</div>
              <div className="text-xs text-fg-mut">{it.label}</div>
              <div className="mt-1">
                <Delta value={it.delta} unit={it.unit ?? "%"} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function TopSections({ stats, ready }: { stats: SectionStat[]; ready: boolean }) {
  const [all, setAll] = useState(false);
  const items = stats.slice(0, all ? 12 : 5);
  return (
    <Card
      title="Seções mais visualizadas"
      action={
        stats.length > 5 ? (
          <button type="button" onClick={() => setAll((v) => !v)} className="inline-flex items-center gap-1 text-sm font-semibold text-accent">
            {all ? "Ver menos" : "Ver todas"} <ArrowRight className="size-3.5" />
          </button>
        ) : undefined
      }
    >
      {!ready ? (
        <Empty icon={Layers} text="As seções aparecem quando a imagem da página estiver disponível." />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {items.map((s, i) => (
            <li key={s.label + i} className="grid grid-cols-[20px_minmax(0,1fr)_minmax(80px,1.2fr)_42px] items-center gap-3 text-sm">
              <span className="grid size-5 place-items-center rounded-full bg-surface-brand text-[10px] font-bold text-accent">{i + 1}</span>
              <span className="truncate text-fg-soft">{s.label}</span>
              <Bar value={s.reach} />
              <span className="text-right font-semibold tabular-nums">{pct(s.reach)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Empty({ icon: Icon, text }: { icon: typeof Clock; text: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center text-sm text-fg-mut">
      <Icon className="size-6 text-accent/50" />
      {text}
    </div>
  );
}

