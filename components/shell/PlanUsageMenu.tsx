"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "@/components/ui/Link";
import { usePathname } from "next/navigation";
import { Activity, ArrowRight, BarChart3, ChevronDown, ClipboardList, Crown, Info, MessageSquare, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatLimit } from "@/lib/plans";
import { useWorkspaceUsage } from "./UsageProvider";

function pctLabel(used: number, limit: number) {
  if (limit === Infinity) return "–";
  const p = (used / limit) * 100;
  if (used > 0 && p < 1) return "<1%";
  return `${Math.min(999, Math.round(p))}%`;
}

function UsageRow({ icon: Icon, label, hint, used, limit }: { icon: LucideIcon; label: string; hint: string; used: number; limit: number }) {
  const pct = limit === Infinity ? 0 : Math.min(100, (used / limit) * 100);
  const tone = pct >= 100 ? "erro" : pct >= 80 ? "aviso" : "ok";
  return (
    <div className="flex items-start gap-3.5">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-bg-sunken text-fg-soft">
        <Icon className="size-[18px]" strokeWidth={1.9} aria-hidden />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-soft">
            {label}
            <span className="group/hint relative inline-flex">
              <Info className="size-3.5 text-fg-mut" aria-hidden />
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-52 -translate-x-1/2 rounded-lg bg-fg px-2.5 py-1.5 text-[11px] font-normal leading-snug text-bg opacity-0 shadow-[var(--shadow-lg)] transition-opacity group-hover/hint:opacity-100"
              >
                {hint}
              </span>
              <span className="sr-only">{hint}</span>
            </span>
          </span>
          <span
            className={cn(
              "whitespace-nowrap text-sm font-bold tabular-nums",
              tone === "erro" ? "text-erro" : tone === "aviso" ? "text-aviso" : "text-fg"
            )}
          >
            {used.toLocaleString("pt-BR")} / {limit === Infinity ? "ilimitado" : formatLimit(limit)}
          </span>
        </div>
        <div
          className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-bg-sunken"
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-700 ease-out",
              tone === "erro" ? "bg-erro" : tone === "aviso" ? "bg-aviso" : "bg-accent"
            )}
            // uso pequeno (ou limite ilimitado) ainda aparece: um ponto no início da barra
            style={{ width: limit === Infinity ? "6px" : `max(6px, ${pct}%)` }}
          />
        </div>
        <div className="mt-1.5 text-right text-xs tabular-nums text-fg-mut">{pctLabel(used, limit)}</div>
      </div>
    </div>
  );
}

/**
 * Plano e uso da WORKSPACE no header: o selo do plano + o botão "Uso do plano", que abre o
 * painel com respostas no mês e pesquisas ativas (todos os projetos) vs. os limites.
 */
export function PlanUsageMenu() {
  const u = useWorkspaceUsage();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const pathname = usePathname();

  // fecha ao navegar
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!u) {
    return (
      <div className="hidden items-center gap-2 md:flex" aria-hidden>
        <span className="h-10 w-[104px] animate-pulse rounded-full bg-bg-sunken max-lg:hidden" />
        <span className="h-10 w-[150px] animate-pulse rounded-full bg-bg-sunken" />
      </div>
    );
  }

  return (
    <div ref={wrap} className="relative hidden items-center gap-2 md:flex">
      <Link
        href="/billing"
        title={`Seu plano: ${u.planLabel}`}
        className="hidden items-center gap-2 rounded-full bg-surface-brand px-4 py-2 text-sm font-semibold text-accent transition hover:brightness-95 lg:inline-flex"
      >
        <Crown className="size-4" aria-hidden />
        {u.planLabel}
      </Link>

      <button
        ref={button}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition",
          open
            ? "border-accent/30 bg-surface-brand text-fg"
            : "border-line-strong bg-bg-elev text-fg-soft hover:border-accent hover:text-accent"
        )}
      >
        <BarChart3 className="size-4 text-accent" aria-hidden />
        Uso do plano
        <ChevronDown className={cn("size-4 text-fg-mut transition-transform duration-200", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Uso do plano"
          className="absolute right-0 top-full z-50 mt-2.5 w-[372px] origin-top-right rounded-2xl border border-line bg-bg-elev p-5 shadow-[0_18px_48px_rgba(30,16,70,.16)] animate-[luumuFade_.16s_ease-out]"
        >
          <div className="text-[15px] font-semibold text-fg">Seu plano atual</div>
          <div className="mt-3 flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-lg text-white [background:var(--grad-roxo)]">
              <Crown className="size-[18px]" aria-hidden />
            </span>
            <span className="flex-1 font-display text-lg font-bold text-accent">{u.planLabel}</span>
            <Link href="/billing" className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">
              Ver plano <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>

          <div className="my-4 h-px bg-line" />

          <div className="flex flex-col gap-4">
            <UsageRow
              icon={MessageSquare}
              label="Respostas no mês"
              hint="Respostas recebidas neste mês em todos os projetos da workspace."
              used={u.usage.responses}
              limit={u.limits.responses}
            />
            <UsageRow
              icon={ClipboardList}
              label="Pesquisas ativas"
              hint="Pesquisas no ar agora, somando todos os projetos da workspace."
              used={u.usage.activeSurveys}
              limit={u.limits.activeSurveys}
            />
            <UsageRow
              icon={Activity}
              label="Eventos rastreados"
              hint="Tipos de evento detectados pelo SDK (cliques, formulários e Luumu.track), somando todos os projetos da workspace."
              used={u.usage.events ?? 0}
              limit={u.limits.events ?? Infinity}
            />
          </div>

          <Link
            href="/billing"
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-line-strong py-2.5 text-sm font-semibold text-accent transition hover:border-accent hover:bg-surface-brand/50"
          >
            Ir para Plano &amp; Cobrança <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      )}
    </div>
  );
}
