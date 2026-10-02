"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Select } from "@/components/ui/Select";
import type { Granularity, ScorePoint } from "@/lib/db/overview";

type Metric = "score" | "positive" | "total";

const axis = { fontSize: 11, fill: "var(--text-mut)", fontFamily: "var(--font-mono)" };

/**
 * "Evolução da nota": linha com pontos, preenchimento suave e tooltip com a data e o valor.
 * Métrica (nota / sentimento / respostas) e granularidade (semanal / diária) trocam no cliente:
 * as duas séries já vêm prontas do servidor, sem nova ida ao banco.
 */
export function ScoreEvolutionCard({
  series,
  scoreLabel,
  scoreSuffix,
  scoreRange,
}: {
  series: Record<Granularity, ScorePoint[]>;
  scoreLabel: string; // "CSAT", "NPS"...
  scoreSuffix: string; // "%" para CSAT, "" para NPS/CES
  scoreRange: { min: number; max: number };
}) {
  const [metric, setMetric] = useState<Metric>("score");
  const [g, setG] = useState<Granularity>("week");

  const points = series[g];
  const data = useMemo(
    () =>
      points.map((p) => ({
        label: p.label,
        value: metric === "score" ? p.score : metric === "positive" ? p.positivePct : p.total,
      })),
    [points, metric]
  );
  const hasData = data.some((d) => d.value != null && (metric !== "total" || d.value > 0));
  const name = metric === "score" ? scoreLabel : metric === "positive" ? "Sentimento positivo" : "Respostas";
  const suffix = metric === "score" ? scoreSuffix : metric === "positive" ? "%" : "";
  const domain: [number | "auto", number | "auto"] =
    metric === "score" ? [scoreRange.min, scoreRange.max] : metric === "positive" ? [0, 100] : [0, "auto"];
  const n = points.length;
  const subtitle =
    g === "week"
      ? `${metric === "total" ? "Total" : "Média"} semanal · ${n === 1 ? "última semana" : `últimas ${n} semanas`}`
      : `${metric === "total" ? "Total" : "Média"} diário · ${n === 1 ? "último dia" : `últimos ${n} dias`}`;

  return (
    <section className="rounded-2xl border border-line bg-bg-elev p-6 shadow-[var(--shadow-sm)]">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight">Evolução da nota</h2>
          <p className="mt-0.5 text-sm text-fg-mut">{subtitle}</p>
        </div>
        <div className="flex gap-2">
          <Select value={metric} onChange={(e) => setMetric(e.target.value as Metric)} className="w-auto min-w-[120px] py-2 text-sm" aria-label="Métrica">
            <option value="score">{scoreLabel}</option>
            <option value="positive">Sentimento</option>
            <option value="total">Respostas</option>
          </Select>
          <Select value={g} onChange={(e) => setG(e.target.value as Granularity)} className="w-auto min-w-[130px] py-2 text-sm" aria-label="Agrupamento">
            <option value="week">Semanal</option>
            <option value="day">Diário</option>
          </Select>
        </div>
      </div>
      {hasData ? (
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={data} margin={{ top: 10, right: 12, left: -14, bottom: 0 }}>
            <defs>
              <linearGradient id="evo-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--luumu-roxo)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--luumu-roxo)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
            <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} dy={8} interval="preserveStartEnd" minTickGap={18} />
            <YAxis tick={axis} axisLine={false} tickLine={false} width={44} domain={domain} allowDecimals={false} />
            <Tooltip
              cursor={{ stroke: "var(--text-mut)", strokeDasharray: "4 4" }}
              content={({ active, payload, label }) =>
                active && payload?.length && payload[0].value != null ? (
                  <div className="rounded-xl border border-line bg-bg-elev px-3 py-2 text-xs shadow-[var(--shadow-lg)]">
                    <div className="font-semibold text-fg">{label}</div>
                    <div className="mt-1 flex items-center gap-1.5 text-fg-soft">
                      <span className="size-2 rounded-full bg-luumu-roxo" />
                      {name}: <span className="font-bold text-fg">{`${payload[0].value}${suffix}`}</span>
                    </div>
                  </div>
                ) : null
              }
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--luumu-roxo)"
              strokeWidth={2.5}
              fill="url(#evo-fill)"
              connectNulls
              dot={{ r: 3.5, fill: "var(--luumu-roxo)", strokeWidth: 0 }}
              activeDot={{ r: 5.5, fill: "var(--luumu-roxo)", stroke: "var(--bg-elev)", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-[250px] items-center justify-center text-sm text-fg-mut">Ainda sem respostas no período para mostrar a evolução.</div>
      )}
    </section>
  );
}
