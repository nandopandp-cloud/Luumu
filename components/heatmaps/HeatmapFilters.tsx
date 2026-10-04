"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, GitCompareArrows, LayoutTemplate, Monitor, Radio } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { DataFilters } from "@/components/ui/DataFilters";
import { cn } from "@/lib/utils";
import { pageLabel, type HeatmapMode } from "@/lib/heatmaps/core";
import { EnableButton, PauseButton } from "./HeatmapStates";

export interface PageOption {
  value: string;
  host: string;
  path: string;
  visits: number;
}

/** Página, período e dispositivo (na URL), comparação de períodos e o estado da coleta. */
export function HeatmapFilters({
  pages,
  selected,
  multiHost,
  device,
  mode,
  compare,
  canCompare,
  enabled,
  canManage,
  quota,
}: {
  pages: PageOption[];
  selected: string;
  multiHost: boolean;
  device: string;
  mode: HeatmapMode;
  compare: boolean;
  canCompare: boolean;
  enabled: boolean;
  canManage: boolean;
  quota: { used: number; limit: number | null };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function update(patch: Record<string, string | null>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        value={selected}
        onChange={(e) => update({ page: e.target.value })}
        aria-label="Página"
        icon={<LayoutTemplate />}
        placeholder="Nenhuma página no período"
        className="w-auto min-w-[260px] max-w-[340px] py-2 text-sm"
      >
        {pages.map((p) => (
          <option key={p.value} value={p.value}>
            {multiHost ? `${p.host} · ${pageLabel(p.path)}` : pageLabel(p.path)}
          </option>
        ))}
      </Select>
      <DataFilters />
      <Select
        value={device}
        onChange={(e) => update({ device: e.target.value || null })}
        aria-label="Dispositivo"
        icon={<Monitor />}
        className="w-auto min-w-[210px] py-2 text-sm"
      >
        <option value="">Todos os dispositivos</option>
        <option value="desktop">Desktop</option>
        <option value="tablet">Tablet</option>
        <option value="mobile">Celular</option>
      </Select>

      <div className="ml-auto flex items-center gap-2">
        <CollectionStatus enabled={enabled} canManage={canManage} quota={quota} />
        {mode === "clicks" && (
          <CompareMenu value={compare} disabled={!canCompare} onChange={(on) => update({ compare: on ? "1" : null })} />
        )}
      </div>
    </div>
  );
}

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return { open, setOpen, ref };
}

function CompareMenu({ value, disabled, onChange }: { value: boolean; disabled: boolean; onChange: (on: boolean) => void }) {
  const { open, setOpen, ref } = usePopover();
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        title={disabled ? "Escolha um período (ex.: últimos 30 dias) para comparar com o anterior" : undefined}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-glow)] transition hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 [background:var(--grad-roxo)]"
      >
        <GitCompareArrows className="size-4" />
        {value ? "Comparando períodos" : "Comparar períodos"}
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-xl border border-line bg-bg-elev py-1 shadow-[var(--shadow-lg)] animate-[luumuSelectIn_.14s_ease-out]">
          {[
            { on: false, label: "Sem comparação", hint: "Só o período escolhido" },
            { on: true, label: "Período anterior", hint: "Mesma duração, logo antes" },
          ].map((o) => (
            <button
              key={o.label}
              role="menuitemradio"
              aria-checked={value === o.on}
              type="button"
              onClick={() => {
                onChange(o.on);
                setOpen(false);
              }}
              className={cn("flex w-full flex-col px-3.5 py-2 text-left transition hover:bg-bg-sunken", value === o.on && "bg-surface-brand/60")}
            >
              <span className="text-sm font-semibold">{o.label}</span>
              <span className="text-xs text-fg-mut">{o.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CollectionStatus({ enabled, canManage, quota }: { enabled: boolean; canManage: boolean; quota: { used: number; limit: number | null } }) {
  const { open, setOpen, ref } = usePopover();
  const pct = quota.limit ? Math.min(100, (quota.used / quota.limit) * 100) : 0;
  const full = quota.limit !== null && quota.used >= quota.limit;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-bg-elev px-3.5 py-2.5 text-sm font-semibold text-fg-soft transition hover:border-accent/50"
      >
        <span className="relative flex size-2.5">
          {enabled && !full && <span className="absolute inline-flex size-full animate-ping rounded-full bg-sucesso opacity-60" />}
          <span className={cn("relative inline-flex size-2.5 rounded-full", !enabled ? "bg-fg-mut" : full ? "bg-aviso" : "bg-sucesso")} />
        </span>
        {!enabled ? "Coleta pausada" : full ? "Limite do plano" : "Coletando"}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-xl border border-line bg-bg-elev p-4 shadow-[var(--shadow-lg)] animate-[luumuSelectIn_.14s_ease-out]">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Radio className="size-4 text-accent" /> Sessões analisadas no mês
          </div>
          <div className="mt-2 flex items-baseline justify-between text-sm">
            <span className="font-display text-xl font-extrabold tabular-nums">{quota.used.toLocaleString("pt-BR")}</span>
            <span className="text-fg-mut">de {quota.limit === null ? "ilimitadas" : quota.limit.toLocaleString("pt-BR")}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg-sunken">
            <div className={cn("h-full rounded-full", full ? "bg-aviso" : "bg-accent")} style={{ width: `max(4px, ${pct}%)` }} />
          </div>
          {full && <p className="mt-2 text-xs text-aviso">O limite do plano foi atingido: novas visitas não são registradas até o próximo mês.</p>}
          <div className="mt-3 border-t border-line pt-2">
            {canManage ? (
              enabled ? (
                <PauseButton compact />
              ) : (
                <div className="pt-1">
                  <EnableButton label="Retomar coleta" />
                </div>
              )
            ) : (
              <p className="text-xs text-fg-mut">Só donos e administradores podem pausar ou retomar.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
