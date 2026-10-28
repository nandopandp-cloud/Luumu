import type { QuestionStat } from "@/lib/db/question-breakdown";

const pctFmt = (n: number) => `${n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const countPct = (b: { count: number; pct: number }) => `${b.count.toLocaleString("pt-BR")} (${pctFmt(b.pct)})`;

/**
 * Aba "Por pergunta": um cartão por pergunta de nota/opção com quantas pessoas deram cada
 * nota (ou escolheram cada opção), o percentual e a média. Essencial no SUS, em que cada
 * item tem leitura própria e a nota agregada não diz onde está o problema.
 */
export function QuestionBreakdown({ stats }: { stats: QuestionStat[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {stats.map((s) => (
        <QuestionCard key={s.id} s={s} />
      ))}
    </div>
  );
}

function QuestionCard({ s }: { s: QuestionStat }) {
  const scale = s.kind === "scale" && s.buckets.length > 0 ? `${s.buckets[0].label}–${s.buckets[s.buckets.length - 1].label}` : null;
  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-line bg-bg-elev p-5 shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-mut">
        <span className="font-semibold uppercase tracking-wide text-fg-soft">{scale ? `Escala ${scale}` : "Opções"}</span>
        <span aria-hidden>•</span>
        <span>{s.answered.toLocaleString("pt-BR")} {s.answered === 1 ? "resposta" : "respostas"}</span>
        {s.avg != null && (
          <>
            <span aria-hidden>•</span>
            <span>
              média <strong className="font-semibold text-fg">{s.avg.toLocaleString("pt-BR")}</strong>
            </span>
          </>
        )}
      </div>
      <h3 className="mt-1.5 font-display text-[15px] font-bold leading-snug">
        <span className="text-fg-mut">Pergunta {s.number}:</span> {s.title}
      </h3>
      {s.answered === 0 ? (
        <p className="mt-4 text-sm text-fg-mut">Ainda sem respostas para esta pergunta.</p>
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
    <figure className="mt-4" aria-label={`Distribuição: ${s.buckets.map((b) => `nota ${b.label}, ${countPct(b)}`).join("; ")}`}>
      <div className="flex h-44 items-end gap-2 border-b border-line-strong">
        {s.buckets.map((b) => (
          <div key={b.label} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end" title={`Nota ${b.label}: ${countPct(b)}`}>
            <span className="mb-1 whitespace-nowrap font-mono text-[11px] font-semibold text-fg-soft">{countPct(b)}</span>
            <span
              className="block w-full max-w-16 rounded-t bg-accent transition group-hover:brightness-110"
              style={{ height: b.count ? `max(${(b.count / top) * 78}%, 3px)` : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2">
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
    <ul className="mt-4 flex flex-col gap-2.5">
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
