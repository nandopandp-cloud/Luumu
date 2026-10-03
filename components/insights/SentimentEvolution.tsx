"use client";

import { useMemo, useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Select } from "@/components/ui/Select";
import { LEVEL_EMOJI } from "@/lib/moods";
import { LEVEL_LABEL, SENTIMENT_LEVELS, type InsightsData, type SentimentLevel } from "@/lib/insights/types";
import { InsightCard } from "./shared";
import { LEVEL_COLOR, SentimentLegend } from "./SentimentLegend";

type View = "levels" | "split";
type Gran = "week" | "day";

const axis = { fontSize: 11, fill: "var(--text-mut)", fontFamily: "var(--font-mono)" };
const SPLIT = [
  { key: "pos", label: "Positivos", color: "#22C55E", emoji: LEVEL_EMOJI.positive },
  { key: "neg", label: "Negativos", color: "#EF4444", emoji: LEVEL_EMOJI.negative },
] as const;

/** Evolução da distribuição de sentimento: uma linha por nível (ou positivos × negativos). */
export function SentimentEvolution({ data }: { data: InsightsData }) {
  const [view, setView] = useState<View>("levels");
  const [g, setG] = useState<Gran>("week");
  const points = data.sentimentEvolution[g];

  const rows = useMemo(
    () =>
      points.map((p) => {
        const l = p.levels;
        return {
          label: p.label,
          total: p.total,
          ...(Object.fromEntries(SENTIMENT_LEVELS.map((k) => [k, l ? l[k] : null])) as Record<SentimentLevel, number | null>),
          pos: l ? l.very_positive + l.positive : null,
          neg: l ? l.negative + l.very_negative : null,
        };
      }),
    [points]
  );
  const n = points.length;
  const subtitle = `Distribuição de sentimentos · ${g === "week" ? (n === 1 ? "última semana" : `últimas ${n} semanas`) : `últimos ${n} dias`}`;

  return (
    <InsightCard id="evolution" labelledBy="evo-title" className="flex h-full flex-col">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="evo-title" className="font-display text-xl font-bold tracking-tight">
            Evolução da nota
          </h2>
          <p className="mt-0.5 text-sm text-fg-mut">{subtitle}</p>
        </div>
        <div className="flex gap-2">
          <Select value={view} onChange={(e) => setView(e.target.value as View)} className="w-auto min-w-[150px] py-2 text-sm" aria-label="Visualização">
            <option value="levels">Sentimento</option>
            <option value="split">Positivo × negativo</option>
          </Select>
          <Select value={g} onChange={(e) => setG(e.target.value as Gran)} className="w-auto min-w-[120px] py-2 text-sm" aria-label="Agrupamento">
            <option value="week">Semanal</option>
            <option value="day">Diário</option>
          </Select>
        </div>
      </div>

      {rows.some((r) => r.total > 0) ? (
        <div className="min-h-[260px] flex-1" role="img" aria-label={`Gráfico: ${subtitle}`}>
          <ResponsiveContainer width="100%" height={270}>
            <ComposedChart data={rows} margin={{ top: 8, right: 14, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="vp-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22C55E" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} dy={8} interval="preserveStartEnd" minTickGap={18} padding={{ left: 10, right: 10 }} />
              <YAxis tick={axis} axisLine={false} tickLine={false} width={46} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                cursor={{ stroke: "var(--text-mut)", strokeDasharray: "4 4" }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0].payload as (typeof rows)[number];
                  if (!row.total) return null;
                  const items =
                    view === "levels"
                      ? SENTIMENT_LEVELS.map((k) => ({ key: k, label: LEVEL_LABEL[k], v: row[k], color: LEVEL_COLOR[k], emoji: LEVEL_EMOJI[k] }))
                      : SPLIT.map((s) => ({ key: s.key, label: s.label, v: row[s.key], color: s.color, emoji: s.emoji }));
                  return (
                    <div className="min-w-[190px] rounded-xl border border-line bg-bg-elev px-3 py-2.5 text-xs shadow-[var(--shadow-lg)]">
                      <div className="mb-1.5 flex justify-between gap-3 font-semibold text-fg">
                        <span>{label}</span>
                        <span className="font-normal text-fg-mut">{row.total} respostas</span>
                      </div>
                      {items.map((it) => (
                        <div key={it.key} className="flex items-center gap-2 py-0.5 text-fg-soft">
                          {/* eslint-disable-next-line @next/next/no-img-element -- emoji decorativo */}
                          <img src={it.emoji} alt="" width={18} height={18} />
                          <span className="flex-1">{it.label}</span>
                          <span className="font-bold" style={{ color: it.color }}>
                            {it.v ?? 0}%
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              {view === "levels" ? (
                <>
                  <Area type="monotone" dataKey="very_positive" name={LEVEL_LABEL.very_positive} stroke={LEVEL_COLOR.very_positive} strokeWidth={2.5} fill="url(#vp-fill)" connectNulls dot={{ r: 3.5, fill: LEVEL_COLOR.very_positive, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                  {(["positive", "neutral", "negative", "very_negative"] as const).map((k) => (
                    <Line key={k} type="monotone" dataKey={k} name={LEVEL_LABEL[k]} stroke={LEVEL_COLOR[k]} strokeWidth={2} connectNulls dot={{ r: 3, fill: LEVEL_COLOR[k], strokeWidth: 0 }} activeDot={{ r: 5 }} />
                  ))}
                </>
              ) : (
                SPLIT.map((s) => (
                  <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2.5} connectNulls dot={{ r: 3.5, fill: s.color, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                ))
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex min-h-[260px] flex-1 items-center justify-center text-sm text-fg-mut">Sem respostas com nota neste período.</div>
      )}

      <div className="mt-4">
        <SentimentLegend items={data.sentimentDistribution} />
      </div>
    </InsightCard>
  );
}
