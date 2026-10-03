"use client";

import Link from "next/link";
import { ClipboardList, MessageSquare, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatLimit } from "@/lib/plans";
import { useWorkspaceUsage } from "./UsageProvider";

function Meter({ icon: Icon, label, used, limit }: { icon: LucideIcon; label: string; used: number; limit: number }) {
  const pct = limit === Infinity ? 0 : Math.min(100, (used / limit) * 100);
  const tone = pct >= 100 ? "erro" : pct >= 80 ? "aviso" : "ok";
  return (
    <div className="flex items-center gap-2.5">
      <Icon
        className={cn("size-[18px] shrink-0", tone === "erro" ? "text-erro" : tone === "aviso" ? "text-aviso" : "text-fg-soft")}
        strokeWidth={1.9}
        aria-hidden
      />
      <div className="w-[92px]">
        <div className="flex items-baseline gap-1 whitespace-nowrap font-display text-[13px] font-bold leading-none tabular-nums text-fg">
          {used.toLocaleString("pt-BR")}
          <span className="font-semibold text-fg-mut">/ {limit === Infinity ? "ilimitado" : formatLimit(limit)}</span>
        </div>
        <div className="mt-0.5 text-[11px] leading-tight text-fg-mut">{label}</div>
        <div className="mt-1 h-[3px] overflow-hidden rounded-full bg-accent/10">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-700 ease-out",
              tone === "erro" ? "bg-erro" : tone === "aviso" ? "bg-aviso" : "[background:var(--grad-roxo)]"
            )}
            // ilimitado não tem "quanto falta": só um ponto de presença
            style={{ width: limit === Infinity ? "3px" : `max(3px, ${pct}%)` }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Respostas no mês e pesquisas ativas da WORKSPACE (todos os projetos) vs. o plano, no
 * header. Clicar leva a Plano & Cobrança.
 */
export function UsageMeters() {
  const u = useWorkspaceUsage();

  if (!u) {
    return (
      <div className="hidden items-center gap-5 px-2 xl:flex" aria-hidden>
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center gap-2.5">
            <span className="size-[18px] animate-pulse rounded bg-bg-sunken" />
            <span className="h-8 w-[92px] animate-pulse rounded-md bg-bg-sunken" />
          </div>
        ))}
      </div>
    );
  }

  const summary = `Plano ${u.planLabel}: ${u.usage.responses.toLocaleString("pt-BR")} de ${formatLimit(u.limits.responses)} respostas neste mês e ${u.usage.activeSurveys} de ${formatLimit(u.limits.activeSurveys)} pesquisas ativas, somando todos os projetos`;
  return (
    <Link
      href="/billing"
      aria-label={`${summary}. Ver plano.`}
      title={`${summary}.`}
      className="hidden items-center gap-5 rounded-xl px-2.5 py-1.5 outline-none transition hover:bg-surface-brand/60 focus-visible:ring-2 focus-visible:ring-accent/40 xl:flex"
    >
      <Meter icon={MessageSquare} label="Respostas no mês" used={u.usage.responses} limit={u.limits.responses} />
      <span className="h-8 w-px bg-line" aria-hidden />
      <Meter icon={ClipboardList} label="Pesquisas ativas" used={u.usage.activeSurveys} limit={u.limits.activeSurveys} />
    </Link>
  );
}
