"use client";

import Link from "next/link";
import { ChevronRight, Crown } from "lucide-react";
import { useWorkspaceUsage } from "./UsageProvider";

/**
 * "Seu plano atual" no rodapé da sidebar. Os números de uso ficam no header (UsageMeters);
 * aqui só o plano e o atalho para Plano & Cobrança.
 */
export function SidebarPlanCard({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const u = useWorkspaceUsage();
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
    <Link
      href="/billing"
      onClick={onNavigate}
      className="group mt-4 flex items-center gap-2.5 rounded-2xl bg-surface-brand/70 p-3 transition hover:bg-surface-brand"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-lg text-white [background:var(--grad-roxo)]">
        <Crown className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-[11px] text-fg-mut">Seu plano atual</span>
        <span className="block font-display text-sm font-bold text-accent">{u.planLabel}</span>
      </span>
      <span className="flex items-center text-xs font-bold text-accent">
        Ver plano
        <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  );
}
