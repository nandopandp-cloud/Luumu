"use client";

import { Plus, X } from "lucide-react";
import { Input, Select } from "@/components/ui/Input";
import { RULE_FIELD_PRESETS, RULE_OP_LABEL } from "@/lib/tours/conditions";
import type { Rule } from "@/lib/tours/types";

const OPS = Object.keys(RULE_OP_LABEL) as Rule["op"][];

/**
 * Editor de condições (segmentação do tour e condições de passo). Campos comuns prontos
 * (plano, cargo, página...) e "Outro atributo" para qualquer trait do Luumu.identify().
 */
export function RulesEditor({
  rules,
  onChange,
  emptyLabel = "Sem condições: vale para todos.",
}: {
  rules: Rule[];
  onChange: (next: Rule[]) => void;
  emptyLabel?: string;
}) {
  const update = (i: number, patch: Partial<Rule>) => onChange(rules.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const presetValues = RULE_FIELD_PRESETS.map((p) => p.value);

  return (
    <div className="flex flex-col gap-2">
      {rules.length === 0 && <p className="text-xs text-fg-mut">{emptyLabel}</p>}
      {rules.map((r, i) => {
        const custom = !presetValues.includes(r.field);
        const noValue = r.op === "exists" || r.op === "not_exists";
        return (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-bg-sunken/60 p-2">
            <Select
              value={custom ? "__custom" : r.field}
              onChange={(e) => update(i, { field: e.target.value === "__custom" ? "user." : e.target.value })}
              className="w-auto min-w-[150px] flex-1 py-1.5 text-sm"
              aria-label="Atributo"
            >
              {RULE_FIELD_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
              <option value="__custom">Outro atributo…</option>
            </Select>
            {custom && (
              <Input
                value={r.field.replace(/^user\./, "")}
                onChange={(e) => update(i, { field: `user.${e.target.value.replace(/[^a-zA-Z0-9_.-]/g, "")}` })}
                placeholder="atributo (ex.: company_size)"
                className="w-40 py-1.5 font-mono text-xs"
                aria-label="Nome do atributo"
              />
            )}
            <Select
              value={r.op}
              onChange={(e) => update(i, { op: e.target.value as Rule["op"] })}
              className="w-auto py-1.5 text-sm"
              aria-label="Operador"
            >
              {OPS.map((op) => (
                <option key={op} value={op}>
                  {RULE_OP_LABEL[op]}
                </option>
              ))}
            </Select>
            {!noValue && (
              <Input
                value={r.value ?? ""}
                onChange={(e) => update(i, { value: e.target.value })}
                placeholder={r.field === "route" ? "/dashboard" : "valor"}
                className="w-auto min-w-[110px] flex-1 py-1.5 text-sm"
                aria-label="Valor"
              />
            )}
            <button
              type="button"
              onClick={() => onChange(rules.filter((_, j) => j !== i))}
              aria-label="Remover condição"
              className="rounded-lg p-1.5 text-fg-mut hover:bg-bg-elev hover:text-erro"
            >
              <X className="size-4" />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => onChange([...rules, { field: "user.plan", op: "eq", value: "" }])}
        className="inline-flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-accent hover:bg-surface-brand"
      >
        <Plus className="size-3.5" /> Adicionar condição
      </button>
    </div>
  );
}
