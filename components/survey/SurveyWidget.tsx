"use client";

import { useMemo, useState } from "react";
import { X, Send, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { LuumuLogo, Mascot } from "@/components/ui/Mascot";
import type { Appearance, BuilderQuestion } from "@/lib/builder";
import { QuestionField, isVisible, type Answers } from "./fields";

/**
 * Cartão da pesquisa nos 4 formatos (popup/slider/modal/bar).
 * É a MESMA UI que o SDK vanilla produz — usado no preview dentro da Luumu.
 * Renderiza uma pergunta por vez (fluxo de widget), diferente do SurveyRenderer
 * (que lista todas numa página).
 */
export function SurveyWidget({
  name,
  questions,
  appearance,
  onClose,
}: {
  name: string;
  questions: BuilderQuestion[];
  appearance: Appearance;
  onClose?: () => void;
}) {
  const [answers, setAnswers] = useState<Answers>({});
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);

  const visible = useMemo(() => questions.filter((q) => isVisible(q, answers)), [questions, answers]);
  const current = visible[step];
  const isLast = step >= visible.length - 1;

  function set(uid: string, value: unknown) {
    setAnswers((a) => ({ ...a, [uid]: value }));
  }
  function next() {
    if (isLast) setDone(true);
    else setStep((s) => s + 1);
  }

  const accentStyle = { ["--accent" as string]: appearance.accent } as React.CSSProperties;
  const isBar = appearance.format === "bar";

  const card = (
    <div
      style={accentStyle}
      className={cn(
        "pointer-events-auto flex flex-col overflow-hidden border border-line bg-bg-elev shadow-[var(--shadow-lg)]",
        isBar ? "w-full rounded-xl" : "w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl"
      )}
    >
      {/* Cabeçalho */}
      <div className={cn("flex items-center justify-between gap-2 px-4", isBar ? "pt-3" : "pt-4")}>
        <div className="flex items-center gap-1.5">
          <LuumuLogo size={18} />
          <span className="text-[11px] font-semibold text-fg-mut">Luumu</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-fg-mut hover:text-fg" aria-label="Fechar">
            <X className="size-4" />
          </button>
        )}
      </div>

      {done ? (
        <div className="flex flex-col items-center px-5 py-6 text-center">
          <Mascot name="Comemorando" size={84} />
          <div className="mt-2 font-display text-base font-extrabold">Obrigado! 💜</div>
          <p className="mt-0.5 text-xs text-fg-mut">Sua resposta ajuda a melhorar.</p>
        </div>
      ) : current ? (
        <div className={cn("px-4", isBar ? "pb-3" : "pb-4 pt-1")}>
          <div className={cn(isBar && "flex items-center gap-4")}>
            <div className={cn(isBar ? "flex-1" : "")}>
              <h3 className="font-display text-[15px] font-bold leading-snug">
                {current.title}
                {current.required && <span className="ml-1 text-erro">*</span>}
              </h3>
              <div className="mt-3">
                <WidgetField q={current} value={answers[current.uid]} onChange={(v) => set(current.uid, v)} />
              </div>
            </div>
            <button
              onClick={next}
              className="mt-3 inline-flex shrink-0 items-center gap-1.5 self-end rounded-full px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
              style={{ background: appearance.accent }}
            >
              {isLast ? <>Enviar <Send className="size-3.5" /></> : <>Próxima <ChevronRight className="size-3.5" /></>}
            </button>
          </div>
          {/* progresso */}
          {visible.length > 1 && (
            <div className="mt-3 flex gap-1">
              {visible.map((_, i) => (
                <span
                  key={i}
                  className={cn("h-1 flex-1 rounded-full", i <= step ? "" : "bg-bg-sunken")}
                  style={i <= step ? { background: appearance.accent } : undefined}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="px-5 py-6 text-center text-sm text-fg-mut">Sem perguntas ainda.</div>
      )}
    </div>
  );

  return card;
}

/** Wrapper que posiciona o widget dentro de um "palco" (área do produto do cliente). */
export function WidgetStage({
  appearance,
  children,
}: {
  appearance: Appearance;
  children: React.ReactNode;
}) {
  const pos = appearance.position;
  const format = appearance.format;

  const wrapClass = cn(
    "pointer-events-none absolute inset-0 flex p-4",
    format === "modal" && "items-center justify-center",
    format === "bar" && pos === "top" && "items-start",
    format === "bar" && pos === "bottom" && "items-end",
    (format === "popup" || format === "slider") && pos === "bottom-right" && "items-end justify-end",
    (format === "popup" || format === "slider") && pos === "bottom-left" && "items-end justify-start"
  );

  return (
    <div className={wrapClass}>
      {format === "modal" && <div className="pointer-events-auto absolute inset-0 bg-black/30" />}
      <div className={cn("relative", format === "bar" && "w-full")}>{children}</div>
    </div>
  );
}

/* campo do widget — mesma renderização dos fields, mas compacto */
function WidgetField({ q, value, onChange }: { q: BuilderQuestion; value: unknown; onChange: (v: unknown) => void }) {
  return <QuestionField q={q} value={value} onChange={onChange} />;
}
