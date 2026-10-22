"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CornerDownLeft, MessagesSquare, RotateCcw, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { SUGGESTED_QUESTIONS } from "@/lib/insights/ask";
import type { ChatTurn, InsightAnswer, InsightsData } from "@/lib/insights/types";
import { InsightsHeader } from "./InsightsHeader";
import { Composer, FollowUp, LuumuAnswer, Typing, UserMessage, type ChatUser } from "./chat/Messages";
import type { SectionAnchor } from "./chat/AnswerVisual";

export interface InsightsFiltersInput {
  period?: string;
  from?: string;
  to?: string;
  surveyId?: string;
  host?: string;
}

export type AskFn = (input: { question: string; filters: InsightsFiltersInput; history: ChatTurn[] }) => Promise<InsightAnswer | { error: string }>;

type Msg =
  | { id: number; role: "user"; text: string; at: string }
  | { id: number; role: "luumu"; answer: InsightAnswer; at: string }
  | { id: number; role: "error"; text: string; at: string };

const now = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** O que vai como histórico para a IA: o que o usuário perguntou e o que a Luumu respondeu. */
function toHistory(msgs: Msg[]): ChatTurn[] {
  return msgs.flatMap((m): ChatTurn[] =>
    m.role === "user"
      ? [{ role: "user", content: m.text }]
      : m.role === "luumu"
      ? [{ role: "assistant", content: [m.answer.title, m.answer.text, m.answer.followUp].filter(Boolean).join(" ") }]
      : []
  );
}

/**
 * Área de Insights com conversa: mostra o painel até a primeira pergunta e então vira um chat
 * com a Luumu. A conversa fica guardada ao voltar para o painel ("Ver detalhes") e pode ser
 * retomada. `ask` é a ação de servidor (IA com plano B por regras).
 */
export function InsightsExperience({
  data,
  user,
  filters,
  filtersSlot,
  ask,
  children,
}: {
  data: InsightsData;
  user: ChatUser;
  filters: InsightsFiltersInput;
  filtersSlot: React.ReactNode;
  ask: AskFn;
  /** os cards do painel (renderizados no servidor) */
  children?: React.ReactNode;
}) {
  const [mode, setMode] = useState<"dashboard" | "chat">("dashboard");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const seq = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode === "chat") endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, pending, mode]);

  async function send(raw: string) {
    const question = raw.trim();
    if (!question || pending) return;
    const history = toHistory(msgs);
    setMsgs((m) => [...m, { id: ++seq.current, role: "user", text: question, at: now() }]);
    setDraft("");
    setMode("chat");
    setPending(true);
    try {
      const res = await ask({ question, filters, history });
      setMsgs((m) => [
        ...m,
        "error" in res
          ? { id: ++seq.current, role: "error", text: res.error, at: now() }
          : { id: ++seq.current, role: "luumu", answer: res, at: now() },
      ]);
    } catch {
      setMsgs((m) => [...m, { id: ++seq.current, role: "error", text: "Não consegui analisar agora. Tente de novo em instantes.", at: now() }]);
    } finally {
      setPending(false);
      inputRef.current?.focus();
    }
  }

  function showSection(anchor: SectionAnchor) {
    setMode("dashboard");
    setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  const lastLuumu = [...msgs].reverse().find((m) => m.role === "luumu");

  if (mode === "chat") {
    return (
      <div className="flex flex-col gap-5">
        <InsightsHeader variant="chat" periodLabel={data.periodLabel} />
        {filtersSlot}
        <section aria-label="Conversa com a Luumu" className="rounded-3xl border border-line bg-bg-sunken/40 p-4 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setMode("dashboard")}
              className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-sm font-semibold text-fg-soft hover:bg-bg-elev hover:text-accent"
            >
              <ArrowLeft className="size-4" /> Voltar aos insights
            </button>
            <button
              type="button"
              onClick={() => {
                setMsgs([]);
                setMode("dashboard");
              }}
              className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-sm font-semibold text-fg-mut hover:bg-bg-elev hover:text-fg"
            >
              <RotateCcw className="size-4" /> Nova conversa
            </button>
          </div>

          <div role="log" aria-live="polite" aria-relevant="additions" className="flex flex-col gap-6">
            {msgs.map((m) =>
              m.role === "user" ? (
                <UserMessage key={m.id} text={m.text} at={m.at} user={user} />
              ) : m.role === "error" ? (
                <div key={m.id} role="alert" className="ml-14 rounded-2xl border border-line bg-bg-elev px-5 py-3 text-sm text-fg-soft">
                  {m.text}
                </div>
              ) : (
                <div key={m.id} className="flex flex-col gap-4">
                  <LuumuAnswer answer={m.answer} at={m.at} data={data} onSection={showSection} />
                  {(m.answer.followUp || m === lastLuumu) && (
                    <FollowUp
                      text={m.answer.followUp}
                      suggestions={m.answer.suggestions}
                      at={m.at}
                      // respostas rápidas só na última mensagem: as antigas já foram respondidas
                      onPick={m === lastLuumu ? (s) => void send(s) : undefined}
                      disabled={pending}
                    />
                  )}
                </div>
              )
            )}
            {pending && <Typing />}
            <div ref={endRef} />
          </div>

          <div className="sticky bottom-4 z-10 mt-6">
            <Composer
              ref={inputRef}
              value={draft}
              onChange={setDraft}
              onSend={() => void send(draft)}
              pending={pending}
              placeholder="Pergunte qualquer coisa sobre seus dados..."
            />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <InsightsHeader variant="dashboard" periodLabel={data.periodLabel} />
      {filtersSlot}
      <section aria-labelledby="ask-title" className="flex flex-col gap-3">
        <h2 id="ask-title" className="sr-only">
          Pergunte algo sobre seus dados
        </h2>
        <Composer
          ref={inputRef}
          value={draft}
          onChange={setDraft}
          onSend={() => void send(draft)}
          pending={pending}
          placeholder="Pergunte algo sobre seus dados..."
        />
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-fg-mut">Exemplos de perguntas:</span>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                // preenche, não envia: a pessoa confirma com Enter
                onClick={() => {
                  setDraft(s);
                  inputRef.current?.focus();
                }}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl border bg-bg-elev px-3.5 py-2 text-xs font-semibold transition hover:-translate-y-px",
                  draft === s ? "border-accent text-accent" : "border-line text-fg-soft hover:border-accent/50 hover:text-accent"
                )}
              >
                <Search className="size-3.5 text-accent" aria-hidden />
                {s}
              </button>
            ))}
          </div>
          {draft && (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-fg-mut">
              <CornerDownLeft className="size-3" /> Pressione Enter para perguntar
            </span>
          )}
        </div>
        {msgs.length > 0 && (
          <button
            type="button"
            onClick={() => setMode("chat")}
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-accent/30 bg-surface-brand px-3.5 py-2 text-sm font-semibold text-accent hover:brightness-95"
          >
            <MessagesSquare className="size-4" /> Voltar à conversa ({msgs.filter((m) => m.role === "user").length})
          </button>
        )}
      </section>
      {children}
    </div>
  );
}
