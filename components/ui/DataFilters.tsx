"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Calendar } from "lucide-react";
import { Select, Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { PERIOD_OPTIONS, periodLabel } from "@/lib/period";

export interface SurveyOption {
  id: string;
  name: string;
}

/**
 * Barra de filtros de pesquisa + período, controlada via query string
 * (?surveyId=&period=&from=&to=). Client component "burro": só lê/escreve a URL —
 * quem busca os dados filtrados são as Server Components das páginas, lendo
 * searchParams e usando periodToRange (lib/period.ts).
 *
 * Quando period=custom, abre um popover com dois <input type="date"> para
 * selecionar início e fim; ao confirmar, grava period=custom&from=&to= na URL.
 */
export function DataFilters({ surveys }: { surveys?: SurveyOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const surveyId = searchParams.get("surveyId") ?? "";
  const period = searchParams.get("period") ?? "30d";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraftFrom(from);
    setDraftTo(to);
  }, [from, to]);

  useEffect(() => {
    if (!pickerOpen) return;
    function onClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setPickerOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [pickerOpen]);

  function update(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function onPeriodChange(value: string) {
    if (value === "custom") {
      setPickerOpen(true);
      // não escreve na URL ainda — só ao confirmar as datas no popover
      return;
    }
    update({ period: value, from: null, to: null });
  }

  function applyCustomRange() {
    if (!draftFrom || !draftTo) return;
    update({ period: "custom", from: draftFrom, to: draftTo });
    setPickerOpen(false);
  }

  const periodSelectValue = period === "custom" && (!from || !to) ? "30d" : period;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {surveys && (
        <Select
          value={surveyId}
          onChange={(e) => update({ surveyId: e.target.value || null })}
          className="w-auto min-w-[180px] py-1.5 text-sm"
        >
          <option value="">Todas as pesquisas</option>
          {surveys.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      )}

      <div className="relative">
        <Select
          value={periodSelectValue}
          onChange={(e) => onPeriodChange(e.target.value)}
          className="w-auto min-w-[160px] py-1.5 text-sm"
        >
          {PERIOD_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.value === "custom" && period === "custom" && from && to
                ? periodLabel(period, from, to)
                : p.label}
            </option>
          ))}
        </Select>

        {pickerOpen && (
          <div
            ref={popoverRef}
            className="absolute right-0 top-full z-30 mt-1.5 w-64 rounded-xl border border-line bg-bg-elev p-3.5 shadow-[var(--shadow-lg)]"
          >
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-fg-soft">
              <Calendar className="size-3.5" /> Período específico
            </div>
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-fg-mut">Início</span>
                <Input
                  type="date"
                  value={draftFrom}
                  max={draftTo || undefined}
                  onChange={(e) => setDraftFrom(e.target.value)}
                  className="py-1.5 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-fg-mut">Fim</span>
                <Input
                  type="date"
                  value={draftTo}
                  min={draftFrom || undefined}
                  onChange={(e) => setDraftTo(e.target.value)}
                  className="py-1.5 text-sm"
                />
              </label>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Button size="sm" onClick={applyCustomRange} disabled={!draftFrom || !draftTo}>
                Aplicar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setPickerOpen(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
