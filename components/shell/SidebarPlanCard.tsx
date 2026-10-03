"use client";

import { use } from "react";
import Link from "next/link";
import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatLimit } from "@/lib/plans";
import type { WorkspaceUsage } from "@/lib/db/workspace";

function Bar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit === Infinity ? 0 : Math.min(100, Math.round((used / limit) * 100));
  return (
    <div>
      <div className="mb-1 flex justify-between gap-2 text-[11px]">
        <span className="text-fg-mut">{label}</span>
        <span className={cn("font-semibold text-fg-soft", pct >= 80 && "text-aviso", pct >= 100 && "text-erro")}>
          {used.toLocaleString("pt-BR")}/{formatLimit(limit)}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-bg-elev">
        <div
          className={cn("h-full rounded-full", pct >= 100 ? "bg-erro" : pct >= 80 ? "bg-aviso" : "[background:var(--grad-roxo)]")}
          style={{ width: `${limit === Infinity ? 4 : Math.max(3, pct)}%` }}
        />
      </div>
    </div>
  );
}

/**
 * "Seu plano atual" no rodapé da sidebar. O uso chega como promise (o layout não espera por
 * ele), então o menu aparece na hora e o card entra quando os números chegam.
 */
export function SidebarPlanCard({
  usage,
  collapsed,
  onNavigate,
}: {
  usage: Promise<WorkspaceUsage | null>;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const u = use(usage);
  if (!u) return null;

  if (collapsed) {
    return (
      <Link
        href="/billing"
        onClick={onNavigate}
        aria-label={`Plano ${u.planLabel}: ver plano`}
        title={`Plano ${u.planLabel}`}
        className="mx-auto mt-4 grid size-10 place-items-center rounded-xl bg-surface-brand text-accent transition hover:brightness-95"
      >
        <Crown className="size-[18px]" aria-hidden />
      </Link>
    );
  }

  return (
    <section aria-label="Seu plano" className="mt-4 rounded-2xl bg-surface-brand/70 p-3.5">
      <div className="flex items-center gap-2.5">
        <span className="grid size-8 place-items-center rounded-lg text-white [background:var(--grad-roxo)]">
          <Crown className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 leading-tight">
          <span className="block text-[11px] text-fg-mut">Seu plano atual</span>
          <span className="block font-display text-sm font-bold text-accent">{u.planLabel}</span>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        <Bar label="Respostas no mês" used={u.usage.responses} limit={u.limits.responses} />
        <Bar label="Pesquisas ativas" used={u.usage.activeSurveys} limit={u.limits.activeSurveys} />
      </div>
      <Link
        href="/billing"
        onClick={onNavigate}
        className="mt-3 block rounded-lg bg-bg-elev py-1.5 text-center text-xs font-bold text-accent transition hover:shadow-[var(--shadow-sm)]"
      >
        Ver plano
      </Link>
    </section>
  );
}
