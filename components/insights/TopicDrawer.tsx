"use client";

import Link from "next/link";
import { Drawer } from "@/components/ui/Drawer";
import type { TopicInsight } from "@/lib/insights/types";
import { CommentItem, ThemeIcon } from "./shared";

/** Detalhe de um tema: volume, sentimento, palavras mais citadas e comentários reais. */
export function TopicDrawer({ topic, onClose }: { topic: TopicInsight; onClose: () => void }) {
  const total = topic.count || 1;
  const seg = [
    { label: "Positivos", n: topic.positive, cls: "bg-sucesso" },
    { label: "Neutros", n: topic.neutral, cls: "bg-aviso" },
    { label: "Negativos", n: topic.negative, cls: "bg-erro" },
  ];
  return (
    <Drawer title={topic.label} subtitle={`${topic.count} comentários · ${topic.pct}% dos comentários com tema`} onClose={onClose}>
      <div className="flex items-center gap-3">
        <ThemeIcon id={topic.id} />
        <div className="flex-1">
          <div className="flex h-2.5 overflow-hidden rounded-full bg-bg-sunken" role="img" aria-label={seg.map((s) => `${s.label}: ${s.n}`).join(", ")}>
            {seg.map((s) => (
              <span key={s.label} className={s.cls} style={{ width: `${(s.n / total) * 100}%` }} />
            ))}
          </div>
          <div className="mt-1.5 flex gap-4 text-xs text-fg-mut">
            {seg.map((s) => (
              <span key={s.label} className="inline-flex items-center gap-1.5">
                <span className={`size-2 rounded-full ${s.cls}`} />
                {s.label} <strong className="text-fg">{s.n}</strong>
              </span>
            ))}
          </div>
        </div>
      </div>

      {topic.keywords.length > 0 && (
        <section className="mt-6">
          <h3 className="text-sm font-bold">O que mais aparece</h3>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {topic.keywords.map((k) => (
              <span key={k.word} className="rounded-lg bg-surface-brand px-2.5 py-1 text-xs font-semibold text-accent">
                {k.word} <span className="font-mono text-fg-mut">{k.count}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6">
        <h3 className="text-sm font-bold">Comentários</h3>
        <div className="mt-2.5 flex flex-col gap-2.5">
          {topic.samples.length ? (
            topic.samples.map((c) => <CommentItem key={c.id} c={c} compact />)
          ) : (
            <p className="text-sm text-fg-mut">Os comentários deste tema são curtos demais para destacar.</p>
          )}
        </div>
        <Link href="/responses?view=comments" className="mt-4 inline-block text-sm font-semibold text-accent hover:underline">
          Ver todas as respostas com comentário →
        </Link>
      </section>
    </Drawer>
  );
}
