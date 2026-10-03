"use client";

import { useCallback, useState } from "react";
import { ArrowDown, ArrowUp, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Drawer } from "@/components/ui/Drawer";
import type { ChangeInsight, TopicInsight } from "@/lib/insights/types";
import { InsightCard } from "./shared";
import { TopicDrawer } from "./TopicDrawer";

function Row({ c, onClick }: { c: ChangeInsight; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 border-b border-line py-3.5 text-left last:border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
    >
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", c.good ? "bg-sucesso/10 text-sucesso" : "bg-erro/10 text-erro")}>
        {c.good ? <ArrowUp className="size-4" aria-hidden /> : <ArrowDown className="size-4" aria-hidden />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{c.label}</span>
        <span className="block text-xs text-fg-mut">{c.description}</span>
      </span>
      <span className={cn("text-sm font-bold", c.good ? "text-sucesso" : "text-erro")}>
        {c.change > 0 ? "+" : ""}
        {c.change}%
      </span>
      <ChevronRight className="size-4 text-fg-mut transition group-hover:translate-x-0.5 group-hover:text-accent" aria-hidden />
    </button>
  );
}

/** Mudanças por tema em relação ao período anterior de mesmo tamanho. */
export function WhatChanged({ changes, topics, hasPrevious }: { changes: ChangeInsight[]; topics: TopicInsight[]; hasPrevious: boolean }) {
  const [compare, setCompare] = useState(false);
  const [topic, setTopic] = useState<TopicInsight | null>(null);
  const openTopic = useCallback((id: string) => setTopic(topics.find((t) => t.id === id) ?? null), [topics]);

  return (
    <InsightCard id="changes" labelledBy="changes-title" className="h-full">
      <div className="flex items-center justify-between gap-3">
        <h2 id="changes-title" className="font-display text-xl font-bold tracking-tight">
          O que mudou?
        </h2>
        <button
          type="button"
          onClick={() => setCompare(true)}
          disabled={!hasPrevious || changes.length === 0}
          className="inline-flex items-center gap-1 rounded-xl border border-line px-3 py-1.5 text-xs font-semibold text-fg-soft transition hover:border-accent hover:text-accent disabled:pointer-events-none disabled:opacity-50"
        >
          Comparar períodos <ChevronRight className="size-3.5" />
        </button>
      </div>
      {!hasPrevious ? (
        <p className="mt-6 text-sm text-fg-mut">Não há respostas no período anterior para comparar. Tente um período mais curto.</p>
      ) : changes.length === 0 ? (
        <p className="mt-6 text-sm text-fg-mut">Nenhum tema mudou de forma relevante em relação ao período anterior.</p>
      ) : (
        <div className="mt-2">
          {changes.slice(0, 4).map((c) => (
            <Row key={c.id} c={c} onClick={() => openTopic(c.id)} />
          ))}
        </div>
      )}

      {compare && (
        <Drawer title="Comparar períodos" subtitle="Cada tema, em relação ao período anterior de mesmo tamanho" onClose={() => setCompare(false)}>
          {changes.map((c) => (
            <Row
              key={c.id}
              c={c}
              onClick={() => {
                setCompare(false);
                openTopic(c.id);
              }}
            />
          ))}
        </Drawer>
      )}
      {topic && <TopicDrawer topic={topic} onClose={() => setTopic(null)} />}
    </InsightCard>
  );
}
