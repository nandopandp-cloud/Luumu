import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatLimit, PLAN_BY_ID, type Plan } from "@/lib/plans";
import { CancelRequestButton } from "./PlanRequest";

function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit === Infinity ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const tone = pct >= 100 ? "bg-erro" : pct >= 80 ? "bg-aviso" : "[background:var(--grad-roxo)]";
  return (
    <div>
      <div className="mb-1.5 flex justify-between gap-3 text-sm">
        <span className="text-fg-soft">{label}</span>
        <span className={cn("font-semibold", pct >= 80 && "text-aviso", pct >= 100 && "text-erro")}>
          {used.toLocaleString("pt-BR")} / {formatLimit(limit)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-bg-sunken" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${limit === Infinity ? 4 : Math.max(2, pct)}%` }} />
      </div>
    </div>
  );
}

/** Plano atual, uso do mês e o pedido de mudança em andamento (se houver). */
export function UsageCard({
  plan,
  usage,
  pending,
  canManage,
}: {
  plan: Plan;
  usage: { responses: number; activeSurveys: number; members: number };
  pending: { plan: string; cycle: string; createdAt: Date } | null;
  canManage: boolean;
}) {
  const month = new Date().toLocaleDateString("pt-BR", { month: "long", timeZone: "America/Sao_Paulo" });
  const requested = pending ? PLAN_BY_ID.get(pending.plan as Plan["id"]) : null;
  return (
    <section aria-labelledby="usage-title" className="rounded-2xl border border-line bg-bg-elev p-6 shadow-[0_1px_2px_rgba(13,15,26,.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="usage-title" className="font-display text-lg font-bold tracking-tight">
            Seu plano: <span className="text-accent">{plan.name}</span>
          </h2>
          <p className="mt-0.5 text-sm text-fg-mut">Uso do workspace em {month} (todos os projetos).</p>
        </div>
        {requested && pending && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-aviso/30 bg-aviso/[.08] px-3.5 py-2 text-sm">
            <Clock className="size-4 text-aviso" aria-hidden />
            <span>
              Mudança para <strong>{requested.name}</strong> ({pending.cycle === "annual" ? "anual" : "mensal"}) solicitada em{" "}
              {pending.createdAt.toLocaleDateString("pt-BR")}. Nossa equipe vai confirmar com você.
            </span>
            {canManage && <CancelRequestButton />}
          </div>
        )}
      </div>
      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
        <Meter label="Respostas neste mês" used={usage.responses} limit={plan.limits.responses} />
        <Meter label="Pesquisas ativas" used={usage.activeSurveys} limit={plan.limits.activeSurveys} />
        <Meter label="Membros" used={usage.members} limit={plan.limits.members} />
      </div>
    </section>
  );
}
