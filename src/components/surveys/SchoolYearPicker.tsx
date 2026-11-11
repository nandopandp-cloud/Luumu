"use client";

import { Check, Minus } from "lucide-react";
import { SEGMENTS, SCHOOL_YEARS, yearsOfSegment } from "@/lib/surveys/school-years";
import { cn } from "@/lib/utils";

/*
  Usado pelo público das pesquisas (SurveySettingsForm) e pelos grupos do convite de
  acessibilidade (components/accessibility). Os códigos são os de lib/surveys/school-years.
*/
/** Seleção de anos escolares agrupada por segmento; o rótulo do segmento marca/desmarca todos os anos dele. */
export function SchoolYearPicker({ selected, onChange }: { selected: string[]; onChange: (next: string[]) => void }) {
  const toggle = (codes: string[], on: boolean) => {
    const set = new Set(selected);
    codes.forEach((c) => (on ? set.add(c) : set.delete(c)));
    // mantém a ordem escolar
    onChange(SCHOOL_YEARS.map((y) => y.code).filter((c) => set.has(c)));
  };

  return (
    <div className="flex flex-col gap-2">
      {SEGMENTS.map((seg) => {
        const codes = yearsOfSegment(seg.id);
        const picked = codes.filter((c) => selected.includes(c)).length;
        const all = picked === codes.length;
        return (
          <div key={seg.id} className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => toggle(codes, !all)}
              aria-pressed={all}
              className="flex w-36 shrink-0 items-center gap-2 text-left text-sm font-semibold text-fg-soft hover:text-accent"
            >
              <span
                className={cn(
                  "grid size-4 shrink-0 place-items-center rounded border",
                  picked ? "border-accent bg-accent text-white" : "border-line-strong"
                )}
              >
                {all ? <Check className="size-3" /> : picked ? <Minus className="size-3" /> : null}
              </span>
              {seg.label}
            </button>
            {SCHOOL_YEARS.filter((y) => y.segment === seg.id).map((y) => {
              const on = selected.includes(y.code);
              return (
                <button
                  key={y.code}
                  type="button"
                  onClick={() => toggle([y.code], !on)}
                  aria-pressed={on}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-semibold transition",
                    on ? "bg-accent text-white" : "bg-bg-sunken text-fg-soft hover:text-accent"
                  )}
                >
                  {y.label}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
