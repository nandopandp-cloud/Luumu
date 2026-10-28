"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Select } from "@/components/ui/Select";
import type { QuestionStat } from "@/lib/db/question-breakdown";

const pctFmt = (n: number) => `${n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const countPct = (b: { count: number; pct: number }) => `${b.count.toLocaleString("pt-BR")} (${pctFmt(b.pct)})`;

/**
 * Visão "Gráfico" da tela de respostas (no lugar dos cards de métricas): uma pergunta por vez,
 * escolhida no seletor ou nas setas, com quantas pessoas deram cada nota e o percentual.
 * Essencial no SUS, em que cada item tem leitura própria e a nota agregada não diz onde está
 * o problema.
 */
export function QuestionChart({ stats }: { stats: QuestionStat[] }) {
  const [index, setIndex] = useState(0);
  const s = stats[Math.min(index, stats.length - 1)];
  if (!s) return null;
  const scale = s.kind === "scale" && s.buckets.length > 0 ? `${s.buckets[0].label}–${s.buckets[s.buckets.length - 1].label}` : null;
  const go = (to: number) => setIndex(Math.max(0, Math.min(stats.length - 1, to)));

  return (
    <section className="rounded-2xl border border-line bg-bg-elev p-5 shadow-[var(--shadow-sm)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-mut">
            <span className="font-semibold uppercase tracking-wide text-fg-soft">{scale ? `Escala ${scale}` : "Opções"}</span>
            <span aria-hidden>•</span>
            <span>
              {s.answered.toLocaleString("pt-BR")} {s.answered === 1 ? "resposta" : "respostas"}
            </span>
            {s.avg != null && (
              <>
                <span aria-hidden>•</span>
                <span>
                  média <strong className="font-semibold text-fg">{s.avg.toLocaleString("pt-BR")}</strong>
                </span>
              </>
            )}
          </div>
          <h2 className="mt-1.5 font-display text-lg font-bold leading-snug">
            <span className="text-fg-mut">Pergunta {s.number}:</span> {s.title}
          </h2>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            aria-label="Pergunta anterior"
            className="grid size-9 place-items-center rounded-lg border border-line-strong text-fg-soft transition hover:border-accent hover:text-accent disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
          </button>
          <Select
            value={String(index)}
            onChange={(e) => go(Number(e.target.value))}
            aria-label="Pergunta"
            className="w-[min(320px,calc(100vw-9rem))] py-2 text-sm"
          >
            {stats.map((q, i) => (
              <option key={q.id} value={String(i)}>
                {`P${q.number} · ${q.title}`}
              </option>
            ))}
          </Select>
          <button
            type="button"
            onClick={() => go(index + 1)}
            disabled={index === stats.length - 1}
            aria-label="Próxima pergunta"
            className="grid size-9 place-items-center rounded-lg border border-line-strong text-fg-soft transition hover:border-accent hover:text-accent disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {s.answered === 0 ? (
        <p className="mt-6 text-sm text-fg-mut">Ainda sem respostas para esta pergunta.</p>
      ) : s.kind === "scale" ? (
        <ScaleChart s={s} />
      ) : (
        <OptionBars s={s} />
      )}
    </section>
  );
}

/** Colunas por nota, com "quantidade (%)" sobre cada uma e os rótulos das pontas embaixo. */
function ScaleChart({ s }: { s: QuestionStat }) {
  const top = Math.max(...s.buckets.map((b) => b.count), 1);
  return (
    <figure className="mt-5" aria-label={`Distribuição: ${s.buckets.map((b) => `nota ${b.label}, ${countPct(b)}`).join("; ")}`}>
      <div className="flex h-48 items-end gap-3 border-b border-line-strong sm:gap-6">
        {s.buckets.map((b) => (
          <div key={b.label} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end" title={`Nota ${b.label}: ${countPct(b)}`}>
            <span className="mb-1.5 whitespace-nowrap rounded-md bg-surface-brand px-1.5 py-0.5 font-mono text-[11px] font-semibold text-fg">
              {countPct(b)}
            </span>
            <span
              className="block w-full rounded-t bg-accent transition group-hover:brightness-110"
              style={{ height: b.count ? `max(${(b.count / top) * 75}%, 3px)` : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-3 sm:gap-6">
        {s.buckets.map((b) => (
          <span key={b.label} className="min-w-0 flex-1 text-center font-mono text-xs text-fg-mut">
            {b.label}
          </span>
        ))}
      </div>
      {(s.minLabel || s.maxLabel) && (
        <figcaption className="mt-2 flex justify-between gap-4 text-xs text-fg-mut">
          <span>{s.minLabel}</span>
          <span className="text-right">{s.maxLabel}</span>
        </figcaption>
      )}
    </figure>
  );
}

/** Uma barra por opção (múltipla escolha, checkbox, dropdown). */
function OptionBars({ s }: { s: QuestionStat }) {
  return (
    <ul className="mt-5 flex flex-col gap-2.5">
      {s.buckets.map((b) => (
        <li key={b.label} className="text-sm" title={`${b.label}: ${countPct(b)}`}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-fg-soft">{b.label}</span>
            <span className="shrink-0 font-mono text-xs font-semibold text-fg-soft">{countPct(b)}</span>
          </div>
          <span className="mt-1 block h-2 overflow-hidden rounded-full bg-bg-sunken">
            <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.min(100, b.pct)}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}
