"use client";

import { useState } from "react";
import { BarChart3, Building2, Check, Lock, Minus, Rocket, Sprout, Star, Zap, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SegmentedControl } from "@/components/ui/Tabs";
import { annualTotal, formatBRL, monthlyPrice, PLANS, type BillingCycle, type Plan, type PlanId } from "@/lib/plans";
import { PlanRequestDialog } from "./PlanRequest";

const ICON: Record<PlanId, { icon: LucideIcon; cls: string }> = {
  free: { icon: Sprout, cls: "bg-sucesso/10 text-sucesso" },
  starter: { icon: Zap, cls: "bg-aviso/15 text-aviso" },
  growth: { icon: BarChart3, cls: "bg-surface-brand text-accent" },
  scale: { icon: Rocket, cls: "bg-sec-azul/10 text-sec-azul" },
  enterprise: { icon: Building2, cls: "bg-fg/10 text-fg-soft" },
};

/** Os cinco planos com Mensal/Anual; o botão de cada um abre o pedido de mudança. */
export function PlanCards({ current, pendingPlan, canManage }: { current: PlanId; pendingPlan: PlanId | null; canManage: boolean }) {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [requesting, setRequesting] = useState<Plan | null>(null);
  const currentPlan = PLANS.find((p) => p.id === current)!;

  return (
    <section aria-labelledby="plans-title" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="plans-title" className="sr-only">
          Planos
        </h2>
        <SegmentedControl<BillingCycle>
          value={cycle}
          onChange={setCycle}
          options={[
            { value: "monthly", label: "Mensal" },
            {
              value: "annual",
              label: "Anual",
              icon: <span className="order-last rounded-full bg-sucesso/15 px-1.5 py-px text-[10px] font-bold text-sucesso">-20%</span>,
            },
          ]}
        />
        {!canManage && (
          <span className="inline-flex items-center gap-1.5 text-xs text-fg-mut">
            <Lock className="size-3.5" /> Só donos e administradores do workspace podem mudar o plano.
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {PLANS.map((p) => {
          const isCurrent = p.id === current;
          const downgrade = (p.monthly ?? Infinity) < (currentPlan.monthly ?? Infinity);
          const price = monthlyPrice(p, cycle);
          const { icon: Icon, cls } = ICON[p.id];
          return (
            <article
              key={p.id}
              aria-label={`Plano ${p.name}`}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-bg-elev p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lg)]",
                isCurrent || p.popular ? "border-accent shadow-[0_0_0_3px_var(--surface-brand)]" : "border-line"
              )}
            >
              {p.popular && (
                <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold text-white shadow-[var(--shadow-glow)] [background:var(--grad-roxo)]">
                  <Star className="size-3 fill-current" /> Mais popular
                </span>
              )}
              <div className="flex items-start gap-3">
                <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", cls)}>
                  <Icon className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h3 className="font-display text-lg font-bold">{p.name}</h3>
                  <p className="text-xs leading-snug text-fg-mut">{p.tagline}</p>
                </div>
              </div>

              <div className="mt-5 min-h-[56px]">
                {price === null ? (
                  <span className="font-display text-[28px] font-extrabold tracking-tight">Sob consulta</span>
                ) : (
                  <>
                    <span className="font-display text-[30px] font-extrabold tracking-tight">R$ {formatBRL(price)}</span>
                    <span className="ml-1 text-sm text-fg-mut">/ mês</span>
                    {cycle === "annual" && price > 0 && (
                      <span className="block text-xs text-fg-mut">R$ {formatBRL(annualTotal(p)!)} cobrados por ano</span>
                    )}
                  </>
                )}
              </div>

              <ul className="mt-4 flex flex-1 flex-col gap-2">
                {p.features.map((f) => (
                  <li key={f.label} className={cn("flex items-start gap-2 text-[13px]", f.included ? "text-fg-soft" : "text-fg-mut/70")}>
                    {f.included ? (
                      <Check className="mt-0.5 size-4 shrink-0 text-sucesso" aria-label="incluído" />
                    ) : (
                      <Minus className="mt-0.5 size-4 shrink-0" aria-label="não incluído" />
                    )}
                    <span>
                      {f.label}
                      {f.soon && f.included && <span className="ml-1.5 rounded-full bg-aviso/15 px-1.5 py-px text-[10px] font-bold text-aviso">Em breve</span>}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                disabled={isCurrent || !canManage}
                onClick={() => setRequesting(p)}
                title={!canManage && !isCurrent ? "Só donos e administradores podem mudar o plano" : undefined}
                className={cn(
                  "mt-5 w-full rounded-xl px-4 py-2.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
                  isCurrent
                    ? "cursor-default text-white [background:var(--grad-roxo)]"
                    : "bg-surface-brand text-accent hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                )}
              >
                {isCurrent ? "Plano atual" : pendingPlan === p.id ? "Mudança solicitada" : downgrade ? `Mudar para ${p.name}` : p.cta}
              </button>
            </article>
          );
        })}
      </div>

      {requesting && <PlanRequestDialog plan={requesting} current={currentPlan} initialCycle={cycle} onClose={() => setRequesting(null)} />}
    </section>
  );
}
