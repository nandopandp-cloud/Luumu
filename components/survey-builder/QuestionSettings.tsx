"use client";

import { Plus, Trash2, GitBranch } from "lucide-react";
import { Switch } from "@/components/ui/Switch";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { blockKind, type BuilderQuestion } from "@/lib/builder";

export function QuestionSettings({
  question,
  index,
  allQuestions,
  onChange,
}: {
  question: BuilderQuestion;
  index: number;
  allQuestions: BuilderQuestion[];
  onChange: (patch: Partial<BuilderQuestion>) => void;
}) {
  const kind = blockKind[question.blockId] ?? "simple";
  const cfg = question.config ?? {};

  const setConfig = (patch: Partial<typeof cfg>) => onChange({ config: { ...cfg, ...patch } });

  // perguntas anteriores que podem servir de gatilho para lógica condicional
  const priors = allQuestions.slice(0, index);

  return (
    <div className="flex flex-col gap-4">
      {/* Título */}
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-fg-soft">Pergunta</span>
        <textarea
          value={question.title}
          onChange={(e) => onChange({ title: e.target.value })}
          rows={3}
          className="w-full resize-y rounded-xl border border-line-strong bg-bg-elev px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
        />
      </label>

      {/* Obrigatória */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-fg-soft">Obrigatória</span>
        <Switch checked={question.required} onChange={(v) => onChange({ required: v })} label="Obrigatória" />
      </div>

      {/* Controles por tipo */}
      {kind === "options" && (
        <div>
          <div className="mb-1.5 text-sm font-semibold text-fg-soft">Opções</div>
          <div className="flex flex-col gap-2">
            {(cfg.options ?? []).map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={opt}
                  onChange={(e) => {
                    const options = [...(cfg.options ?? [])];
                    options[i] = e.target.value;
                    setConfig({ options });
                  }}
                  className="py-2"
                />
                <button
                  onClick={() => setConfig({ options: (cfg.options ?? []).filter((_, j) => j !== i) })}
                  className="shrink-0 text-fg-mut hover:text-erro"
                  aria-label="Remover opção"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
            <Button
              variant="subtle"
              size="sm"
              className="w-full"
              onClick={() => setConfig({ options: [...(cfg.options ?? []), `Opção ${(cfg.options?.length ?? 0) + 1}`] })}
            >
              <Plus className="size-3.5" /> Adicionar opção
            </Button>
          </div>
        </div>
      )}

      {kind === "scale" && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-fg-soft">Mínimo</span>
              <Input
                type="number"
                value={cfg.min ?? 0}
                onChange={(e) => setConfig({ min: Number(e.target.value) })}
                className="py-2"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-fg-soft">Máximo</span>
              <Input
                type="number"
                value={cfg.max ?? 10}
                onChange={(e) => setConfig({ max: Number(e.target.value) })}
                className="py-2"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-fg-soft">Rótulo início</span>
              <Input value={cfg.minLabel ?? ""} onChange={(e) => setConfig({ minLabel: e.target.value })} className="py-2" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-fg-soft">Rótulo fim</span>
              <Input value={cfg.maxLabel ?? ""} onChange={(e) => setConfig({ maxLabel: e.target.value })} className="py-2" />
            </label>
          </div>
        </div>
      )}

      {kind === "text" && (
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-fg-soft">Placeholder</span>
          <Input value={cfg.placeholder ?? ""} onChange={(e) => setConfig({ placeholder: e.target.value })} className="py-2" />
        </label>
      )}

      {/* Lógica condicional */}
      <div className="rounded-xl bg-bg-sunken p-3">
        <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-fg-soft">
          <GitBranch className="size-3.5 text-accent" /> Lógica condicional
        </div>
        {priors.length === 0 ? (
          <p className="text-xs text-fg-mut">
            Adicione perguntas antes desta para poder criar condições.
          </p>
        ) : question.logic?.showIf ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-fg-mut">Mostrar esta pergunta somente se:</p>
            <Select
              value={question.logic.showIf.questionUid}
              onChange={(e) =>
                onChange({ logic: { showIf: { ...question.logic.showIf!, questionUid: e.target.value } } })
              }
              className="py-2"
            >
              {priors.map((p, i) => (
                <option key={p.uid} value={p.uid}>
                  {String(i + 1).padStart(2, "0")} · {p.title.slice(0, 32)}
                </option>
              ))}
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={question.logic.showIf.op}
                onChange={(e) =>
                  onChange({ logic: { showIf: { ...question.logic.showIf!, op: e.target.value as "lte" | "gte" | "eq" } } })
                }
                className="py-2"
              >
                <option value="lte">for ≤</option>
                <option value="gte">for ≥</option>
                <option value="eq">for =</option>
              </Select>
              <Input
                value={String(question.logic.showIf.value)}
                onChange={(e) => {
                  const raw = e.target.value;
                  const num = Number(raw);
                  onChange({
                    logic: { showIf: { ...question.logic.showIf!, value: raw !== "" && !isNaN(num) ? num : raw } },
                  });
                }}
                className="py-2"
                placeholder="valor"
              />
            </div>
            <button
              onClick={() => onChange({ logic: {} })}
              className="self-start text-xs font-semibold text-erro hover:underline"
            >
              Remover regra
            </button>
          </div>
        ) : (
          <Button
            variant="subtle"
            size="sm"
            className="w-full"
            onClick={() =>
              onChange({ logic: { showIf: { questionUid: priors[priors.length - 1].uid, op: "lte", value: 6 } } })
            }
          >
            <Plus className="size-3.5" /> Adicionar regra
          </Button>
        )}
      </div>
    </div>
  );
}
