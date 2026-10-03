"use client";

import { useRef, useState, useTransition } from "react";
import { ArrowRight, CornerDownLeft, Info, Loader2, Search, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SUGGESTED_QUESTIONS } from "@/lib/insights/ask";
import type { InsightAnswer } from "@/lib/insights/types";

export type AskFn = (question: string) => Promise<InsightAnswer | { error: string }>;

/**
 * "Pergunte algo sobre seus dados". Quem responde é `ask` (na página: a ação de servidor que
 * usa a IA e, sem ela, as regras locais). Recebido por parâmetro para a interface não depender
 * do provedor — e para ser testada sem banco nem chave de IA.
 */
export function AiQuery({ ask: askFn }: { ask: AskFn }) {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<InsightAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  function ask() {
    const text = q.trim();
    if (!text) return input.current?.focus();
    setError(null);
    start(async () => {
      try {
        const res = await askFn(text);
        if ("error" in res) {
          setAnswer(null);
          setError(res.error);
        } else setAnswer(res);
      } catch {
        setError("Não foi possível analisar agora. Tente de novo em instantes.");
      }
    });
  }

  return (
    <section aria-labelledby="ask-title" className="flex flex-col gap-3">
      <h2 id="ask-title" className="sr-only">
        Pergunte algo sobre seus dados
      </h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask();
        }}
        onClick={() => input.current?.focus()}
        className="group flex cursor-text items-center gap-3 rounded-[22px] border border-accent/20 bg-bg-elev py-2.5 pl-3 pr-2.5 shadow-[0_8px_30px_rgba(107,43,217,.08)] transition focus-within:border-accent/50 focus-within:shadow-[0_0_0_4px_rgba(107,43,217,.10),0_8px_30px_rgba(107,43,217,.10)]"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-brand text-accent" aria-hidden>
          <Sparkles className="size-5" />
        </span>
        <input
          ref={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Pergunte algo sobre seus dados..."
          aria-label="Pergunte algo sobre seus dados"
          className="min-w-0 flex-1 bg-transparent py-2 text-[15px] text-fg outline-none placeholder:text-fg-mut"
        />
        {q && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setQ("");
              setAnswer(null);
              input.current?.focus();
            }}
            aria-label="Limpar pergunta"
            className="rounded-lg p-1.5 text-fg-mut hover:bg-bg-sunken hover:text-fg"
          >
            <X className="size-4" />
          </button>
        )}
        <button
          type="submit"
          aria-label="Perguntar"
          disabled={pending}
          className="grid size-11 shrink-0 place-items-center rounded-full text-white shadow-[var(--shadow-glow)] transition hover:-translate-y-0.5 [background:var(--grad-roxo)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/25"
        >
          {pending ? <Loader2 className="size-5 animate-spin" /> : <ArrowRight className="size-5" />}
        </button>
      </form>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-fg-mut">Exemplos de perguntas:</span>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_QUESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              // preenche, não envia: a pessoa confirma com Enter
              onClick={() => {
                setQ(s);
                setAnswer(null);
                input.current?.focus();
              }}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border bg-bg-elev px-3.5 py-2 text-xs font-semibold transition hover:-translate-y-px",
                q === s ? "border-accent text-accent" : "border-line text-fg-soft hover:border-accent/50 hover:text-accent"
              )}
            >
              <Search className="size-3.5 text-accent" aria-hidden />
              {s}
            </button>
          ))}
        </div>
        {q && !answer && !pending && (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-fg-mut">
            <CornerDownLeft className="size-3" /> Pressione Enter para perguntar
          </span>
        )}
      </div>

      {pending && (
        <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-2xl border border-accent/20 bg-surface-brand/40 p-5 text-sm text-fg-soft">
          <Loader2 className="size-4 animate-spin text-accent" /> Analisando seus dados…
        </div>
      )}
      {error && !pending && (
        <div role="alert" className="rounded-2xl border border-line bg-bg-sunken p-4 text-sm text-fg-soft">
          {error}
        </div>
      )}

      {answer && !pending && (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "rounded-2xl border p-5 animate-[luumuFade_.2s_ease-out]",
            answer.answered ? "border-accent/20 bg-surface-brand/50" : "border-line bg-bg-sunken"
          )}
        >
          <div className="flex items-start gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-bg-elev text-accent">
              {answer.answered ? <Sparkles className="size-4" /> : <Info className="size-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-fg-mut">{answer.question}</p>
              <p className="mt-1 text-sm font-semibold leading-relaxed text-fg">{answer.text}</p>
              {answer.bullets.length > 0 && (
                <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-fg-soft">
                  {answer.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                {answer.anchor && (
                  <a href={`#${answer.anchor}`} className="font-semibold text-accent hover:underline">
                    Ver na página →
                  </a>
                )}
                <span className="text-fg-mut">
                  {answer.source === "ai"
                    ? "Resposta gerada pela IA da Luumu a partir das respostas e comentários deste período."
                    : "Resposta montada automaticamente a partir dos números deste período."}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
