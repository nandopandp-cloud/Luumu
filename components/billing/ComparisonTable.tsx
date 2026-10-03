"use client";

import { useState } from "react";
import { Check, ChevronDown, Info, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { COMPARE_ROWS, PLANS, type CellValue, type PlanId } from "@/lib/plans";

function Cell({ v }: { v: CellValue }) {
  if (v === true) return <Check className="mx-auto size-4 text-sucesso" aria-label="incluído" />;
  if (v === false) return <Minus className="mx-auto size-4 text-fg-mut/60" aria-label="não incluído" />;
  return <span>{v}</span>;
}

/** "Compare os planos": linhas principais e, sob demanda, todos os recursos. */
export function ComparisonTable({ highlight }: { highlight: PlanId }) {
  const [all, setAll] = useState(false);
  const rows = COMPARE_ROWS.filter((r) => all || !r.extra);
  const hl = (id: PlanId) => id === highlight && "bg-surface-brand/50";

  return (
    <section aria-labelledby="compare-title" className="rounded-2xl border border-line bg-bg-elev p-6">
      <h2 id="compare-title" className="font-display text-xl font-bold tracking-tight">
        Compare os planos
      </h2>
      <div className="-mx-6 mt-5 overflow-x-auto px-6">
        <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th scope="col" className="w-[26%] pb-3 text-left text-xs font-semibold uppercase tracking-wide text-fg-mut">
                Recursos
              </th>
              {PLANS.map((p) => (
                <th
                  key={p.id}
                  scope="col"
                  className={cn("rounded-t-xl px-3 pb-3 pt-2 text-center font-display text-[15px] font-bold", hl(p.id), p.id === highlight && "text-accent")}
                >
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.label} className="group">
                <th scope="row" className="border-t border-line py-3 pr-3 text-left font-medium text-fg-soft">
                  <span className="inline-flex items-center gap-1.5">
                    {r.label}
                    <span className="group/tip relative inline-flex">
                      <Info className="size-3.5 text-fg-mut/70" aria-hidden />
                      <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-56 -translate-x-1/2 rounded-lg bg-fg px-3 py-2 text-xs font-normal leading-snug text-bg opacity-0 shadow-lg transition group-hover/tip:opacity-100">
                        {r.hint}
                      </span>
                      <span className="sr-only">{r.hint}</span>
                    </span>
                    {r.soon && <span className="rounded-full bg-aviso/15 px-1.5 py-px text-[10px] font-bold text-aviso">Em breve</span>}
                  </span>
                </th>
                {PLANS.map((p) => (
                  <td
                    key={p.id}
                    className={cn(
                      "border-t border-line px-3 py-3 text-center text-fg-soft",
                      hl(p.id),
                      p.id === highlight && "font-semibold text-fg",
                      p.id === highlight && i === rows.length - 1 && "rounded-b-xl"
                    )}
                  >
                    <Cell v={r.values[p.id]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        aria-expanded={all}
        onClick={() => setAll((v) => !v)}
        className="mx-auto mt-4 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-accent transition hover:bg-surface-brand"
      >
        {all ? "Ver menos recursos" : "Ver todos os recursos"}
        <ChevronDown className={cn("size-4 transition-transform", all && "rotate-180")} aria-hidden />
      </button>
    </section>
  );
}
