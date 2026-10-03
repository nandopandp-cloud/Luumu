import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sparkline } from "@/components/ui/InsightCard";
import { moodFor } from "@/lib/moods";
import type { SatisfactionMetric } from "@/lib/insights/types";
import { InsightCard } from "./shared";

/** Satisfação geral: a nota principal do período, a variação e a tendência semanal. */
export function SatisfactionCard({ s }: { s: SatisfactionMetric | null }) {
  const numeric = s ? Number(s.value.replace(/[^\d.-]/g, "")) : NaN;
  const mood = Number.isFinite(numeric) && s?.value.endsWith("%") ? moodFor(numeric) : null;
  const d = s?.delta;
  const flat = d && Math.abs(d.value) < 0.05;
  const good = d ? (d.inverted ? d.value < 0 : d.value > 0) : false;
  return (
    <InsightCard labelledBy="sat-title" className="relative h-full overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <h2 id="sat-title" className="font-display text-xl font-bold tracking-tight">
          Satisfação geral
        </h2>
        {mood && (
          <span className="grid size-12 place-items-center rounded-full bg-surface-brand" title={mood.label}>
            {/* eslint-disable-next-line @next/next/no-img-element -- emoji decorativo */}
            <img src={mood.src} alt="" width={36} height={36} />
          </span>
        )}
      </div>
      {s ? (
        <>
          <div className="mt-3 font-display text-[44px] font-extrabold leading-none tracking-tight text-luumu-roxo" title={s.formula}>
            {s.value}
          </div>
          <div className="mt-1 text-xs font-semibold text-fg-mut">{s.label}</div>
          <div className="mt-3 text-sm">
            {d ? (
              <>
                <span className={cn("inline-flex items-center gap-1 font-bold", flat ? "text-fg-mut" : good ? "text-sucesso" : "text-erro")}>
                  {flat ? <Minus className="size-4" /> : d.value > 0 ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
                  {Math.abs(d.value).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} {d.unit}
                </span>
                <div className="text-fg-mut">vs. período anterior</div>
              </>
            ) : (
              <span className="text-fg-mut">Sem dados no período anterior</span>
            )}
          </div>
          <div className="mt-4">
            <Sparkline values={s.trend} tone="roxo" className="h-16 w-full" />
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm text-fg-mut">As pesquisas deste recorte não têm pergunta de nota.</p>
      )}
    </InsightCard>
  );
}
