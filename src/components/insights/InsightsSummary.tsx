import { AlertTriangle, ArrowUpRight, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InsightSummary } from "@/lib/insights/types";
import { InsightCard } from "./shared";

const MINI = [
  { key: "positives", label: "pontos positivos", one: "ponto positivo", hint: "O que está funcionando", icon: ArrowUpRight, box: "bg-sucesso/[.07]", dot: "bg-sucesso", text: "text-sucesso" },
  { key: "attention", label: "pontos de atenção", one: "ponto de atenção", hint: "Merecem investigação", icon: AlertTriangle, box: "bg-aviso/[.09]", dot: "bg-sec-laranja", text: "text-sec-laranja" },
  { key: "opportunities", label: "oportunidades", one: "oportunidade", hint: "Para evoluir seu produto", icon: Lightbulb, box: "bg-surface-brand/70", dot: "[background:var(--grad-roxo)]", text: "text-accent" },
] as const;

/** Resumo do período: a leitura em linguagem simples + os três contadores. */
export function InsightsSummary({ summary, periodLabel }: { summary: InsightSummary; periodLabel: string }) {
  return (
    <InsightCard id="summary" labelledBy="summary-title" className="h-full">
      <h2 id="summary-title" className="font-display text-xl font-bold tracking-tight">
        Resumo dos {periodLabel}
      </h2>
      <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-fg-soft">{summary.headline}</p>
      <p className="mt-1.5 text-sm text-fg-mut">{summary.detail}</p>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {MINI.map((m) => {
          const v = summary[m.key];
          const Icon = m.icon;
          return (
            <div key={m.key} className={cn("flex items-start gap-3 rounded-2xl p-4", m.box)} title={v.items.join(", ") || undefined}>
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-full text-white", m.dot)}>
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <div className={cn("font-display text-2xl font-extrabold leading-none", m.text)}>{v.count}</div>
                <div className={cn("mt-1 text-sm font-semibold", m.text)}>{v.count === 1 ? m.one : m.label}</div>
                <div className="mt-0.5 text-xs text-fg-mut">{v.items.length ? v.items.slice(0, 2).join(", ") : m.hint}</div>
              </div>
            </div>
          );
        })}
      </div>
    </InsightCard>
  );
}
