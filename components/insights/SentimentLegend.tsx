import { cn } from "@/lib/utils";
import { LEVEL_EMOJI } from "@/lib/moods";
import type { SentimentCategory } from "@/lib/insights/types";

export const LEVEL_COLOR = {
  very_positive: "#22C55E",
  positive: "#8B5CF6",
  neutral: "#EAB308",
  negative: "#EF4444",
  very_negative: "#991B1B",
} as const;

const BOX = {
  very_positive: "bg-sucesso/[.07]",
  positive: "bg-surface-brand/60",
  neutral: "bg-aviso/[.08]",
  negative: "bg-erro/[.06]",
  very_negative: "bg-erro/[.09]",
} as const;

/** Os cinco níveis do período, cada um com o emoji do mascote. */
export function SentimentLegend({ items }: { items: SentimentCategory[] }) {
  return (
    <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5" aria-label="Distribuição de sentimento no período">
      {items.map((c) => (
        <li key={c.level} className={cn("flex items-center gap-2.5 rounded-2xl px-3 py-2.5", BOX[c.level])}>
          {/* eslint-disable-next-line @next/next/no-img-element -- emoji decorativo */}
          <img src={LEVEL_EMOJI[c.level]} alt="" width={38} height={38} className="size-[38px] shrink-0" />
          <div className="min-w-0 leading-tight">
            <div className="font-display text-lg font-extrabold" style={{ color: LEVEL_COLOR[c.level] }}>
              {c.pct}%
            </div>
            <div className="truncate text-xs text-fg-mut" title={`${c.count} respostas`}>
              {c.label}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
