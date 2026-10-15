"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/Tabs";
import { formatValue, METRIC_META, NORTH_STAR, PLATFORMS, type GoalKey, type Metric, type PlatformKey } from "@/lib/product-report/indicators";
import type { ReportModel } from "@/lib/product-report/model";

const axis = { fontSize: 11, fill: "var(--text-mut)", fontFamily: "var(--font-mono)" };
const ROXO = "#6B2BD9";

type Scope = "consolidado" | PlatformKey;

interface ChartDef {
  key: GoalKey;
  title: string;
  unit: "%" | "min" | "pts";
}

function chartsFor(scope: Scope): ChartDef[] {
  if (scope === "consolidado") {
    return [
      { key: NORTH_STAR, title: "North Star", unit: "pts" },
      ...(["csat", "adherence", "usage"] as Metric[]).map((m) => ({ key: `ns.${m}` as GoalKey, title: `${METRIC_META[m].label} (média das plataformas)`, unit: METRIC_META[m].unit })),
    ];
  }
  const p = PLATFORMS.find((x) => x.key === scope)!;
  return (p.metrics as readonly Metric[]).map((m) => ({ key: `${p.key}.${m}` as GoalKey, title: `${METRIC_META[m].label} · ${p.label}`, unit: METRIC_META[m].unit }));
}

function Tip({ active, payload, label, unit }: { active?: boolean; payload?: { name: string; value: number | null; color: string }[]; label?: string; unit: ChartDef["unit"] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-bg-elev px-3 py-2 text-xs shadow-[var(--shadow-md)]">
      <div className="mb-1 font-semibold text-fg">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-fg-soft">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-semibold text-fg">{formatValue(p.value, unit)}</span>
        </div>
      ))}
    </div>
  );
}

/** Ponto do realizado: vermelho quando abaixo da meta da própria quinzena. */
function Dot(props: { cx?: number; cy?: number; payload?: { value: number | null; meta: number | null } }) {
  const { cx, cy, payload } = props;
  if (cx === undefined || cy === undefined || payload?.value == null) return null;
  const below = payload.meta != null && payload.value < payload.meta;
  return <circle cx={cx} cy={cy} r={4} fill={below ? "#dc2626" : ROXO} stroke="var(--bg-elev)" strokeWidth={1.5} />;
}

function HistoryChart({ model, def }: { model: ReportModel; def: ChartDef }) {
  const data = model.history.map((h) => ({ label: h.label, value: h.values[def.key] ?? null, meta: h.targets[def.key] ?? null }));
  const hasData = data.some((d) => d.value !== null);
  return (
    <div className="rounded-xl border border-line p-4">
      <div className="mb-2 text-sm font-semibold">{def.title}</div>
      {hasData ? (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} />
            <YAxis tick={axis} axisLine={false} tickLine={false} width={48} domain={["auto", "auto"]} tickFormatter={(v: number) => formatValue(v, def.unit)} />
            <Tooltip content={<Tip unit={def.unit} />} />
            {/* meta como linha de referência tracejada (pode mudar de uma quinzena para outra) */}
            <Line type="stepAfter" name="Meta" dataKey="meta" stroke="#9ca3af" strokeDasharray="5 4" strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false} />
            <Line type="linear" name="Realizado" dataKey="value" stroke={ROXO} strokeWidth={2.5} dot={<Dot />} activeDot={false} connectNulls={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <p className="flex h-[200px] items-center justify-center text-sm text-fg-mut">Sem dados nas últimas quinzenas.</p>
      )}
    </div>
  );
}

export function ProductReportCharts({ model }: { model: ReportModel }) {
  const [scope, setScope] = useState<Scope>("consolidado");
  return (
    <Card>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Evolução</CardTitle>
          <CardSubtitle>Últimas {model.history.length} quinzenas · tracejado = meta · ponto vermelho = abaixo da meta.</CardSubtitle>
        </div>
        <SegmentedControl<Scope>
          size="sm"
          value={scope}
          onChange={setScope}
          options={[{ value: "consolidado", label: "Consolidado" }, ...PLATFORMS.map((p) => ({ value: p.key as Scope, label: p.label }))]}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {chartsFor(scope).map((def) => (
          <HistoryChart key={def.key} model={model} def={def} />
        ))}
      </div>
    </Card>
  );
}
