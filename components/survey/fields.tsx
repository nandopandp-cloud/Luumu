"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { scoreBlocks, type BuilderQuestion } from "@/lib/builder";

export type Answers = Record<string, unknown>;

/** Avalia se uma pergunta deve aparecer dada a lógica condicional. */
export function isVisible(q: BuilderQuestion, answers: Answers): boolean {
  const rule = q.logic?.showIf;
  if (!rule) return true;
  const dep = answers[rule.questionUid];
  if (dep == null) return false;
  const depNum = typeof dep === "number" ? dep : Number(dep);
  const val = typeof rule.value === "number" ? rule.value : Number(rule.value);
  if (isNaN(depNum) || isNaN(val)) return String(dep) === String(rule.value) && rule.op === "eq";
  if (rule.op === "lte") return depNum <= val;
  if (rule.op === "gte") return depNum >= val;
  return depNum === val;
}

/** Normaliza o valor de resposta para persistência. */
export function normalize(q: BuilderQuestion, value: unknown) {
  if (scoreBlocks.has(q.blockId)) return { score: value };
  if (q.blockId === "long" || q.blockId === "short") return { text: value };
  return { value };
}

/** Campo de resposta por tipo de bloco. */
export function QuestionField({
  q, value, onChange,
}: {
  q: BuilderQuestion; value: unknown; onChange: (v: unknown) => void;
}) {
  const cfg = q.config ?? {};

  if (["nps", "ces", "scale", "rating", "csat"].includes(q.blockId)) {
    const min = cfg.min ?? (q.blockId === "nps" ? 0 : 1);
    const max = cfg.max ?? (q.blockId === "nps" ? 10 : 5);
    const nums = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    return (
      <div>
        <div className="flex flex-wrap gap-2">
          {nums.map((n) => (
            <button
              key={n}
              onClick={() => onChange(n)}
              className={cn(
                "grid size-11 place-items-center rounded-xl border text-sm font-bold transition",
                value === n
                  ? "border-transparent text-white [background:var(--grad-roxo)]"
                  : "border-line-strong bg-bg-elev hover:border-accent hover:text-accent"
              )}
            >
              {n}
            </button>
          ))}
        </div>
        {(cfg.minLabel || cfg.maxLabel) && (
          <div className="mt-1.5 flex justify-between text-xs text-fg-mut">
            <span>{cfg.minLabel}</span>
            <span>{cfg.maxLabel}</span>
          </div>
        )}
      </div>
    );
  }

  if (q.blockId === "stars") {
    const max = cfg.max ?? 5;
    const cur = typeof value === "number" ? value : 0;
    return (
      <div className="flex gap-1.5">
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <button key={n} onClick={() => onChange(n)} aria-label={`${n} estrelas`}>
            <svg viewBox="0 0 24 24" className={cn("size-9 transition", n <= cur ? "fill-sec-amarelo" : "fill-bg-sunken")}>
              <path d="M12 2l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 18l-5.8 3 1.1-6.5L2.6 9.8l6.5-.9z" />
            </svg>
          </button>
        ))}
      </div>
    );
  }

  if (q.blockId === "emoji") {
    const emojis = ["😡", "🙁", "😐", "🙂", "😍"];
    return (
      <div className="flex gap-2">
        {emojis.map((e, i) => (
          <button
            key={i}
            onClick={() => onChange(i + 1)}
            className={cn(
              "grid size-12 place-items-center rounded-xl border text-2xl transition",
              value === i + 1 ? "border-accent bg-surface-brand" : "border-line-strong hover:border-accent"
            )}
          >
            {e}
          </button>
        ))}
      </div>
    );
  }

  if (q.blockId === "choice") {
    return (
      <div className="flex flex-col gap-2">
        {(cfg.options ?? []).map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition",
              value === o ? "border-accent bg-surface-brand text-accent" : "border-line-strong bg-bg-elev hover:border-accent"
            )}
          >
            <span className={cn("grid size-5 place-items-center rounded-full border-2", value === o ? "border-accent" : "border-line-strong")}>
              {value === o && <span className="size-2.5 rounded-full bg-accent" />}
            </span>
            {o}
          </button>
        ))}
      </div>
    );
  }

  if (q.blockId === "checkbox") {
    const arr = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="flex flex-col gap-2">
        {(cfg.options ?? []).map((o) => {
          const on = arr.includes(o);
          return (
            <button
              key={o}
              onClick={() => onChange(on ? arr.filter((x) => x !== o) : [...arr, o])}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition",
                on ? "border-accent bg-surface-brand text-accent" : "border-line-strong bg-bg-elev hover:border-accent"
              )}
            >
              <span className={cn("grid size-5 place-items-center rounded-md border-2", on ? "border-accent bg-accent text-white" : "border-line-strong")}>
                {on && <Check className="size-3" />}
              </span>
              {o}
            </button>
          );
        })}
      </div>
    );
  }

  if (q.blockId === "dropdown") {
    return (
      <select
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full max-w-md rounded-xl border border-line-strong bg-bg-elev px-3.5 py-2.5 text-sm focus:border-accent focus:outline-none"
      >
        <option value="" disabled>Selecione…</option>
        {(cfg.options ?? []).map((o) => <option key={o}>{o}</option>)}
      </select>
    );
  }

  if (q.blockId === "date") {
    return (
      <input
        type="date"
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-line-strong bg-bg-elev px-3.5 py-2.5 text-sm focus:border-accent focus:outline-none"
      />
    );
  }

  if (q.blockId === "file") {
    return (
      <div className="rounded-xl border border-dashed border-line-strong bg-bg-sunken px-4 py-8 text-center text-sm text-fg-mut">
        Arraste um arquivo ou clique para enviar
      </div>
    );
  }

  if (q.blockId === "short") {
    return (
      <input
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={cfg.placeholder}
        className="w-full max-w-md rounded-xl border border-line-strong bg-bg-elev px-3.5 py-2.5 text-sm focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
      />
    );
  }

  return (
    <textarea
      value={(value as string) ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={cfg.placeholder}
      rows={4}
      className="w-full max-w-xl resize-y rounded-xl border border-line-strong bg-bg-elev px-3.5 py-2.5 text-sm focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
    />
  );
}
