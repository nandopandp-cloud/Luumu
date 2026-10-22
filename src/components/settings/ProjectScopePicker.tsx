"use client";

import { Check, FolderKanban, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProjectOption {
  id: string;
  name: string;
}

/**
 * Seleção dos projetos que um membro enxerga.
 *
 * A convenção do backend é que lista vazia = acesso a todos os projetos, então a UI expõe
 * exatamente esses dois estados: "Todos os projetos" (seleção vazia) e "Projetos
 * específicos" (seleção explícita). Manter o vazio como "todos" — em vez de marcar todos os
 * checkboxes — é o que faz projetos criados depois entrarem no acesso automaticamente.
 */
export function ProjectScopePicker({
  projects,
  selected,
  onChange,
  disabled = false,
}: {
  projects: ProjectOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const all = selected.length === 0;

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((p) => p !== id) : [...selected, id]);
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange([])}
        aria-pressed={all}
        className={cn(
          "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition disabled:opacity-50",
          all ? "border-accent bg-surface-brand" : "border-line hover:border-line-strong"
        )}
      >
        <span
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-lg",
            all ? "bg-accent text-white" : "bg-fg/8 text-fg-mut"
          )}
        >
          <Globe className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Todos os projetos</span>
          <span className="block text-xs text-fg-mut">
            Inclui projetos criados no futuro.
          </span>
        </span>
        {all && <Check className="size-4 shrink-0 text-accent" />}
      </button>

      <div className="rounded-xl border border-line">
        <div className="border-b border-line px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-wide text-fg-mut">
          Ou apenas projetos específicos
        </div>
        <div className="max-h-52 overflow-y-auto p-1.5">
          {projects.length === 0 ? (
            <p className="px-2 py-3 text-sm text-fg-mut">Nenhum projeto no workspace.</p>
          ) : (
            projects.map((p) => {
              const on = selected.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggle(p.id)}
                  aria-pressed={on}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition hover:bg-bg-sunken disabled:opacity-50"
                >
                  <span
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-md border transition",
                      on ? "border-accent bg-accent text-white" : "border-line-strong"
                    )}
                  >
                    {on && <Check className="size-3.5" />}
                  </span>
                  <FolderKanban className="size-4 shrink-0 text-fg-mut" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                </button>
              );
            })
          )}
        </div>
      </div>

      <p className="text-xs text-fg-mut">
        {all
          ? "Este membro enxerga todos os projetos do workspace."
          : `Este membro enxerga apenas ${selected.length} ${
              selected.length === 1 ? "projeto" : "projetos"
            } — os demais ficam ocultos.`}
      </p>
    </div>
  );
}
