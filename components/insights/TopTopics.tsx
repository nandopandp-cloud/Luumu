"use client";

import { useState } from "react";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import type { TopicInsight } from "@/lib/insights/types";
import { InsightCard, ThemeIcon } from "./shared";
import { TopicDrawer } from "./TopicDrawer";

const SHOWN = 6;

/** Temas mais mencionados nos comentários; cada um abre o detalhe. */
export function TopTopics({ topics, base }: { topics: TopicInsight[]; base: number }) {
  const [open, setOpen] = useState<TopicInsight | null>(null);
  const shown = topics.slice(0, SHOWN);
  const rest = topics.slice(SHOWN);
  const restPct = Math.max(0, 100 - shown.reduce((s, t) => s + t.pct, 0));
  const max = Math.max(1, ...topics.map((t) => t.pct));

  return (
    <InsightCard id="topics" labelledBy="topics-title" className="h-full">
      <h2 id="topics-title" className="font-display text-xl font-bold tracking-tight">
        Temas mais mencionados
      </h2>
      <p className="mt-0.5 text-sm text-fg-mut">Base: {base.toLocaleString("pt-BR")} comentários com tema</p>
      {topics.length === 0 ? (
        <p className="mt-6 text-sm text-fg-mut">Ainda não há comentários suficientes para identificar temas.</p>
      ) : (
        <ul className="mt-4 flex flex-col">
          {shown.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setOpen(t)}
                className="group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-bg-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
              >
                <ThemeIcon id={t.id} className="size-8" />
                <span className="min-w-0 flex-1 text-sm font-semibold">{t.label}</span>
                <span className="hidden h-2 w-20 overflow-hidden rounded-full bg-bg-sunken sm:block">
                  <span className="block h-full rounded-full [background:var(--grad-roxo)]" style={{ width: `${(t.pct / max) * 100}%` }} />
                </span>
                <span className="w-10 text-right text-sm font-semibold text-fg-soft">{t.pct}%</span>
                <ChevronRight className="size-4 text-fg-mut transition group-hover:translate-x-0.5 group-hover:text-accent" aria-hidden />
              </button>
            </li>
          ))}
          {rest.length > 0 && (
            <li className="flex items-center gap-3 px-2 py-2" title={rest.map((t) => t.label).join(", ")}>
              <span className="grid size-8 place-items-center rounded-xl bg-surface-brand text-accent">
                <MoreHorizontal className="size-4" aria-hidden />
              </span>
              <span className="flex-1 text-sm font-semibold">Outros</span>
              <span className="hidden h-2 w-20 overflow-hidden rounded-full bg-bg-sunken sm:block">
                <span className="block h-full rounded-full [background:var(--grad-roxo)]" style={{ width: `${(restPct / max) * 100}%` }} />
              </span>
              <span className="w-10 text-right text-sm font-semibold text-fg-soft">{restPct}%</span>
              <span className="w-4" />
            </li>
          )}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-fg-mut">Um comentário pode citar mais de um tema.</p>
      {open && <TopicDrawer topic={open} onClose={() => setOpen(null)} />}
    </InsightCard>
  );
}
