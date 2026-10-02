"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { SegmentedControl } from "@/components/ui/Tabs";
import type { WordCloudItem } from "@/lib/wordcloud";

// da nota mais alta para a mais baixa: verde → vermelho
const SCALE = ["#22C55E", "#84CC16", "#FACC15", "#FB923C", "#EF4444"];

function colorFor(index: number, total: number) {
  if (total <= 1) return SCALE[0];
  return SCALE[Math.round((index / (total - 1)) * (SCALE.length - 1))];
}

export function ScoreDistributionCard({ buckets, total }: { buckets: { label: string; value: number }[]; total: number }) {
  return (
    <section className="rounded-2xl border border-line bg-bg-elev p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-2">
        <BarChart3 className="size-4 text-accent" />
        <h2 className="font-display text-base font-bold">Distribuição de notas</h2>
      </div>
      <p className="mt-0.5 text-xs text-fg-mut">Base: {total.toLocaleString("pt-BR")} respostas</p>
      <ul className="mt-4 flex flex-col gap-2.5">
        {buckets.map((b, i) => (
          <li key={b.label} className="flex items-center gap-3 text-sm">
            <span className="w-6 shrink-0 font-mono text-xs font-semibold text-fg-soft">{b.label}</span>
            <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-bg-sunken">
              <span className="block h-full rounded-full transition-all" style={{ width: `${b.value}%`, background: colorFor(i, buckets.length) }} />
            </span>
            <span className="w-10 shrink-0 text-right text-xs font-bold">{b.value}%</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const CLOUD_COLORS = ["text-accent", "text-sec-azul", "text-luumu-roxo-claro", "text-sec-ciano", "text-fg-soft"];

export function WordsCard({ words }: { words: WordCloudItem[] }) {
  const [mode, setMode] = useState<"cloud" | "list">("cloud");
  return (
    <section className="rounded-2xl border border-line bg-bg-elev p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-bold">Palavras mais citadas</h2>
        <SegmentedControl<"cloud" | "list">
          size="sm"
          value={mode}
          onChange={setMode}
          options={[
            { value: "cloud", label: "Nuvem" },
            { value: "list", label: "Lista" },
          ]}
        />
      </div>
      {words.length === 0 ? (
        <p className="mt-4 text-sm text-fg-mut">As palavras mais citadas aparecem aqui conforme chegam comentários.</p>
      ) : mode === "cloud" ? (
        <div className="mt-5 flex flex-wrap items-baseline justify-center gap-x-3 gap-y-2">
          {words.map((w, i) => (
            <span
              key={w.text}
              title={`${w.count}×`}
              className={`font-display font-bold leading-none ${CLOUD_COLORS[i % CLOUD_COLORS.length]}`}
              style={{ fontSize: 12 + w.weight * 22, opacity: 0.6 + w.weight * 0.4 }}
            >
              {w.text}
            </span>
          ))}
        </div>
      ) : (
        <ol className="mt-4 flex flex-col gap-2">
          {words.slice(0, 12).map((w, i) => (
            <li key={w.text} className="flex items-center gap-3 text-sm">
              <span className="w-5 font-mono text-xs text-fg-mut">{i + 1}</span>
              <span className="flex-1 font-semibold capitalize">{w.text}</span>
              <span className="h-1.5 w-20 overflow-hidden rounded-full bg-bg-sunken">
                <span className="block h-full rounded-full [background:var(--grad-roxo)]" style={{ width: `${Math.max(6, w.weight * 100)}%` }} />
              </span>
              <span className="w-8 text-right font-mono text-xs text-fg-mut">{w.count}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
