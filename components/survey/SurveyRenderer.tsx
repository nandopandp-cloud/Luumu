"use client";

import { useMemo, useState } from "react";
import { Check, Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Mascot } from "@/components/ui/Mascot";
import { scoreBlocks, type BuilderQuestion } from "@/lib/builder";
import { submitResponseAction } from "@/app/(app)/surveys/actions";

type Answers = Record<string, unknown>;

/** Avalia se uma pergunta deve aparecer dada a lógica condicional. */
function isVisible(q: BuilderQuestion, answers: Answers): boolean {
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

export function SurveyRenderer({
  surveyId,
  surveyName,
  questions,
  preview = false,
}: {
  surveyId: string;
  surveyName: string;
  questions: BuilderQuestion[];
  preview?: boolean;
}) {
  const [answers, setAnswers] = useState<Answers>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => questions.filter((q) => isVisible(q, answers)), [questions, answers]);

  function set(uid: string, value: unknown) {
    setAnswers((a) => ({ ...a, [uid]: value }));
  }

  async function submit() {
    // valida obrigatórias visíveis
    const missing = visible.find((q) => q.required && (answers[q.uid] == null || answers[q.uid] === ""));
    if (missing) {
      setError("Responda todas as perguntas obrigatórias.");
      return;
    }
    setError(null);
    if (preview) {
      setDone(true);
      return;
    }
    setSubmitting(true);
    // deriva score principal da 1ª pergunta de nota respondida
    const scoreQ = visible.find((q) => scoreBlocks.has(q.blockId) && typeof answers[q.uid] === "number");
    const score = scoreQ ? (answers[scoreQ.uid] as number) : null;
    try {
      await submitResponseAction({
        surveyId,
        answers: visible.map((q) => ({ questionId: q.uid, value: normalize(q, answers[q.uid]) })),
        score,
      });
      setDone(true);
    } catch {
      setError("Não foi possível enviar. Tente novamente.");
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <Mascot name="Comemorando" size={140} float />
        <h2 className="mt-5 font-display text-2xl font-extrabold">Obrigado! 💜</h2>
        <p className="mt-1.5 max-w-sm text-fg-mut">
          {preview ? "Fim do preview. É assim que o respondente vê sua pesquisa." : "Sua resposta foi registrada. Você acaba de ajudar a melhorar."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {visible.map((q, i) => (
        <div key={q.uid} className="flex flex-col gap-3">
          <label className="font-display text-lg font-bold leading-snug">
            <span className="mr-2 font-mono text-sm text-fg-mut">{String(i + 1).padStart(2, "0")}</span>
            {q.title}
            {q.required && <span className="ml-1 text-erro">*</span>}
          </label>
          <QuestionField q={q} value={answers[q.uid]} onChange={(v) => set(q.uid, v)} />
        </div>
      ))}

      {error && <p className="text-sm font-medium text-erro">{error}</p>}

      <Button size="lg" onClick={submit} disabled={submitting} className="mt-2 self-start">
        {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        Enviar resposta
      </Button>
    </div>
  );
}

function normalize(q: BuilderQuestion, value: unknown) {
  if (scoreBlocks.has(q.blockId)) return { score: value };
  if (q.blockId === "long" || q.blockId === "short") return { text: value };
  return { value };
}

/* ---- Campo por tipo de bloco ---- */
function QuestionField({
  q, value, onChange,
}: {
  q: BuilderQuestion; value: unknown; onChange: (v: unknown) => void;
}) {
  const cfg = q.config ?? {};

  // Escalas numéricas (nps/ces/scale/rating/csat)
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

  // Estrelas
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

  // Emoji
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

  // Múltipla escolha (uma opção)
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

  // Checkbox (várias)
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

  // Dropdown
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

  // Data
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

  // Arquivo
  if (q.blockId === "file") {
    return (
      <div className="rounded-xl border border-dashed border-line-strong bg-bg-sunken px-4 py-8 text-center text-sm text-fg-mut">
        Arraste um arquivo ou clique para enviar
      </div>
    );
  }

  // Texto curto
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

  // Texto longo (default)
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
