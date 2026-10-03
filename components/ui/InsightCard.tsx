import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export type Tone = "roxo" | "verde" | "azul" | "laranja";

const TONE: Record<Tone, { text: string; stroke: string; fill: string; chip: string }> = {
  roxo: { text: "text-luumu-roxo", stroke: "#6B2BD9", fill: "rgba(107,43,217,.14)", chip: "bg-surface-brand text-accent" },
  verde: { text: "text-luumu-verde", stroke: "#4CB82F", fill: "rgba(126,217,87,.18)", chip: "bg-luumu-verde/15 text-luumu-verde" },
  azul: { text: "text-sec-azul", stroke: "#4AA8FF", fill: "rgba(74,168,255,.16)", chip: "bg-sec-azul/10 text-sec-azul" },
  laranja: { text: "text-sec-laranja", stroke: "#FF8A3D", fill: "rgba(255,138,61,.16)", chip: "bg-sec-laranja/10 text-sec-laranja" },
};

/** Minigráfico de linha (área suave). SVG puro: renderiza no servidor, sem JS no cliente. */
export function Sparkline({ values, tone, className }: { values: number[]; tone: Tone; className?: string }) {
  if (values.length < 2) return <div className={className ?? "h-10 w-28"} />;
  const W = 112;
  const H = 40;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * W, H - 4 - ((v - min) / span) * (H - 8)] as const);
  // curva suave (Catmull-Rom → Bézier)
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[Math.max(0, i - 1)];
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const [x3, y3] = pts[Math.min(pts.length - 1, i + 2)];
    d += ` C${x1 + (x2 - x0) / 6},${y1 + (y2 - y0) / 6} ${x2 - (x3 - x1) / 6},${y2 - (y3 - y1) / 6} ${x2},${y2}`;
  }
  const t = TONE[tone];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={cn("shrink-0 overflow-visible", className ?? "h-10 w-28")} aria-hidden>
      <path d={`${d} L${W},${H} L0,${H} Z`} fill={t.fill} />
      <path d={d} fill="none" stroke={t.stroke} strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

/** Minigráfico de barras (para notas médias por dia). */
function Bars({ values, tone }: { values: number[]; tone: Tone }) {
  if (values.length < 2) return <div className="h-10 w-28" />;
  const last = values.slice(-10);
  const max = Math.max(...last) || 1;
  const t = TONE[tone];
  return (
    <svg viewBox="0 0 112 40" className="h-10 w-28 shrink-0" aria-hidden>
      {last.map((v, i) => {
        const h = Math.max(4, (v / max) * 36);
        const w = 112 / last.length - 4;
        return <rect key={i} x={i * (112 / last.length) + 2} y={40 - h} width={w} height={h} rx={2} fill={t.stroke} opacity={0.25 + (0.75 * (i + 1)) / last.length} />;
      })}
    </svg>
  );
}

/** Variação percentual de uma contagem (null sem base de comparação). */
export function pctDelta(cur: number, prev: number | null | undefined): Delta | null {
  if (!prev) return null;
  return { value: Math.round(((cur - prev) / prev) * 1000) / 10, unit: "%" };
}

/** Diferença entre duas notas na mesma metodologia (pontos de NPS/CES, p.p. de CSAT). */
export function scoreDelta(
  cur: { value: number | null; methodology: string; lowerIsBetter: boolean } | null,
  prev: { value: number | null; methodology: string } | null
): Delta | null {
  if (cur?.value == null || prev?.value == null || cur.methodology !== prev.methodology) return null;
  return {
    value: Math.round((cur.value - prev.value) * 10) / 10,
    unit: cur.methodology === "nps" || cur.methodology === "ces" ? "pts" : "p.p.",
    inverted: cur.lowerIsBetter,
  };
}

export interface Delta {
  value: number; // variação (já na unidade de exibição)
  unit: "%" | "p.p." | "pts";
  /** true quando subir é ruim (ex.: CES) — inverte a cor */
  inverted?: boolean;
}

export function InsightCard({
  label,
  value,
  tone,
  icon,
  series,
  chart = "line",
  delta,
  hint,
}: {
  label: string;
  value: string;
  tone: Tone;
  icon: React.ReactNode;
  series: number[];
  chart?: "line" | "bars";
  delta: Delta | null;
  hint?: string;
}) {
  const t = TONE[tone];
  const flat = delta && Math.abs(delta.value) < 0.05;
  const good = delta ? (delta.inverted ? delta.value < 0 : delta.value > 0) : false;
  return (
    <div className="rounded-2xl border border-line bg-bg-elev p-5 shadow-[var(--shadow-sm)]" title={hint}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-semibold text-fg-soft">{label}</span>
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", t.chip)}>{icon}</span>
      </div>
      <div className="mt-1 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className={cn("font-display text-[34px] font-extrabold leading-none tracking-tight", t.text)}>{value}</div>
          <div className="mt-2.5 h-9 text-xs">
            {delta ? (
              <>
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 font-bold",
                    flat ? "text-fg-mut" : good ? "text-sucesso" : "text-erro"
                  )}
                >
                  {flat ? <Minus className="size-3.5" /> : delta.value > 0 ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
                  {Math.abs(delta.value).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                  {delta.unit === "%" ? "%" : ` ${delta.unit}`}
                </span>
                <div className="text-fg-mut">vs. período anterior</div>
              </>
            ) : (
              <span className="text-fg-mut">Sem dados no período anterior</span>
            )}
          </div>
        </div>
        {chart === "bars" ? <Bars values={series} tone={tone} /> : <Sparkline values={series} tone={tone} />}
      </div>
    </div>
  );
}
