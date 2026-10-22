"use client";

import { forwardRef } from "react";
import Image from "next/image";
import { ArrowDown, ArrowRight, ArrowUp, CheckCheck, Info, Loader2, Minus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InsightAnswer, InsightsData } from "@/lib/insights/types";
import { AnswerVisual, SIDE_VISUALS, type SectionAnchor } from "./AnswerVisual";

export interface ChatUser {
  name: string;
  avatarUrl: string | null;
}

/** Avatar da Luumu nas mensagens (o mascote feliz). */
export function LuumuAvatar() {
  return (
    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-bg-elev shadow-[0_4px_14px_rgba(75,28,171,.14)]" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element -- asset estático */}
      <img src="/mascot/emotions/4-feliz.webp" alt="" width={34} height={34} />
    </span>
  );
}

function UserAvatar({ user }: { user: ChatUser }) {
  return user.avatarUrl ? (
    <Image src={user.avatarUrl} alt="" width={44} height={44} className="size-11 shrink-0 rounded-full object-cover" />
  ) : (
    <span className="grid size-11 shrink-0 place-items-center rounded-full text-sm font-bold text-white [background:var(--grad-marca)]" aria-hidden>
      {user.name.charAt(0).toUpperCase()}
    </span>
  );
}

const Time = ({ at, read }: { at: string; read?: boolean }) => (
  <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-fg-mut">
    {at}
    {read && <CheckCheck className="size-3.5 text-accent" aria-label="enviada" />}
  </span>
);

export function UserMessage({ text, at, user }: { text: string; at: string; user: ChatUser }) {
  return (
    <div className="flex items-start justify-end gap-3 animate-[luumuFade_.2s_ease-out]">
      <div className="flex max-w-[78%] flex-col items-end">
        <div className="rounded-2xl rounded-tr-md bg-surface-brand px-5 py-3 text-[15px] font-medium text-fg shadow-[0_1px_2px_rgba(13,15,26,.04)]">
          {text}
        </div>
        <Time at={at} read />
      </div>
      <UserAvatar user={user} />
    </div>
  );
}

const TREND = {
  up: { icon: ArrowUp, cls: "bg-sucesso/10 text-sucesso" },
  down: { icon: ArrowDown, cls: "bg-erro/10 text-erro" },
  neutral: { icon: Minus, cls: "bg-bg-sunken text-fg-mut" },
} as const;

/** Resposta da Luumu: destaque, explicação, pontos com direção e o bloco visual. */
export function LuumuAnswer({
  answer,
  at,
  data,
  onSection,
}: {
  answer: InsightAnswer;
  at: string;
  data: InsightsData;
  onSection: (a: SectionAnchor) => void;
}) {
  const side = SIDE_VISUALS.includes(answer.visual);
  const visual = answer.visual !== "none" ? <AnswerVisual visual={answer.visual} data={data} onSection={onSection} /> : null;
  return (
    <div className="flex items-start gap-3 animate-[luumuFade_.25s_ease-out]">
      <LuumuAvatar />
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "rounded-2xl rounded-tl-md border p-5",
            answer.answered ? "border-line bg-bg-elev" : "border-line bg-bg-sunken"
          )}
        >
          <div className={cn("grid gap-5", side && visual && "lg:grid-cols-[minmax(0,1fr)_340px]")}>
            <div className="min-w-0">
              <p className="flex items-start gap-2 font-display text-[17px] font-bold leading-snug text-fg">
                {!answer.answered && <Info className="mt-0.5 size-4 shrink-0 text-fg-mut" aria-hidden />}
                {answer.title}
              </p>
              {answer.text && <p className="mt-2 text-sm leading-relaxed text-fg-soft">{answer.text}</p>}
              {answer.points.length > 0 && (
                <ul className="mt-4 flex flex-col gap-3.5">
                  {answer.points.map((p, i) => {
                    const t = TREND[p.trend ?? "neutral"];
                    const Icon = t.icon;
                    return (
                      <li key={i} className="flex items-start gap-3">
                        <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", t.cls)}>
                          <Icon className="size-4" aria-hidden />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-fg">{p.text}</span>
                          {p.detail && <span className="mt-0.5 block text-xs leading-relaxed text-fg-mut">{p.detail}</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {!side && visual && <div className="mt-4">{visual}</div>}
            </div>
            {side && visual && <div>{visual}</div>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3">
          <Time at={at} />
          <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-fg-mut">
            {answer.source === "ai" ? (
              <>
                <Sparkles className="size-3" /> Analisado pela IA da Luumu com as respostas deste período
              </>
            ) : (
              "Montado automaticamente com os números deste período"
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Pergunta de continuação da Luumu + respostas rápidas. */
export function FollowUp({
  text,
  suggestions,
  at,
  onPick,
  disabled,
}: {
  text: string;
  suggestions: string[];
  at: string;
  onPick?: (s: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 animate-[luumuFade_.3s_ease-out]">
      {text && (
        <div className="flex items-start gap-3">
          <LuumuAvatar />
          <div>
            <div className="rounded-2xl rounded-tl-md border border-line bg-bg-elev px-5 py-3 text-[15px] font-medium text-fg">{text}</div>
            <Time at={at} />
          </div>
        </div>
      )}
      {onPick && suggestions.length > 0 && (
        <div className={cn("flex flex-wrap gap-2", text && "pl-14")}>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              disabled={disabled}
              onClick={() => onPick(s)}
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-bg-elev px-4 py-2 text-sm font-semibold text-fg-soft transition hover:-translate-y-px hover:border-accent/50 hover:text-accent disabled:pointer-events-none disabled:opacity-50"
            >
              {s}
              <ArrowRight className="size-3.5 text-accent" aria-hidden />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** "Digitando…" da Luumu enquanto a resposta não chega. */
export function Typing() {
  return (
    <div className="flex items-center gap-3" role="status" aria-label="A Luumu está analisando">
      <LuumuAvatar />
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-md border border-line bg-bg-elev px-5 py-4">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-2 rounded-full bg-accent/60 motion-safe:animate-bounce"
            style={{ animationDelay: `${i * 140}ms` }}
          />
        ))}
        <span className="ml-2 text-xs text-fg-mut">Analisando seus dados…</span>
      </div>
    </div>
  );
}

/** Campo de escrita da conversa (Enter envia). */
export const Composer = forwardRef<
  HTMLInputElement,
  { value: string; onChange: (v: string) => void; onSend: () => void; pending: boolean; placeholder: string; className?: string }
>(function Composer({ value, onChange, onSend, pending, placeholder, className }, ref) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
      }}
      className={cn(
        "flex items-center gap-3 rounded-[22px] border border-accent/25 bg-bg-elev py-2.5 pl-3 pr-2.5 shadow-[0_8px_30px_rgba(107,43,217,.10)] transition focus-within:border-accent/50 focus-within:shadow-[0_0_0_4px_rgba(107,43,217,.10),0_8px_30px_rgba(107,43,217,.12)]",
        className
      )}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-brand text-accent" aria-hidden>
        <Sparkles className="size-5" />
      </span>
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Pergunte algo sobre seus dados"
        maxLength={500}
        className="min-w-0 flex-1 bg-transparent py-2 text-[15px] text-fg outline-none placeholder:text-fg-mut"
      />
      <button
        type="submit"
        aria-label="Enviar pergunta"
        disabled={pending || !value.trim()}
        className="grid size-11 shrink-0 place-items-center rounded-full text-white shadow-[var(--shadow-glow)] transition hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 [background:var(--grad-roxo)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/25"
      >
        {pending ? <Loader2 className="size-5 animate-spin" /> : <ArrowRight className="size-5" />}
      </button>
    </form>
  );
});
