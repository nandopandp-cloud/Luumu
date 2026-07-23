"use client";

import { useMemo, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Mascot } from "@/components/ui/Mascot";
import { scoreBlocks, type BuilderQuestion } from "@/lib/builder";
import { submitResponseAction } from "@/app/(app)/surveys/actions";
import { QuestionField, isVisible, normalize, type Answers } from "./fields";

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
