import {
  BarChart3,
  BookOpen,
  Bug,
  CircleDollarSign,
  Gauge,
  Headphones,
  HeartPulse,
  KeyRound,
  ListChecks,
  MessageCircle,
  MousePointerClick,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SENTIMENT_EMOJI } from "@/lib/moods";
import type { FeedbackComment } from "@/lib/insights/types";

/* Peças compartilhadas da área Insights (servidor e cliente: sem hooks aqui). */

export const THEME_ICON: Record<string, LucideIcon> = {
  performance: Gauge,
  bugs: Bug,
  workload: ListChecks,
  scoring: Trophy,
  content: BookOpen,
  usability: MousePointerClick,
  engagement: HeartPulse,
  support: Headphones,
  reports: BarChart3,
  access: KeyRound,
  price: CircleDollarSign,
  general: MessageCircle,
};

export function ThemeIcon({ id, className }: { id: string; className?: string }) {
  const Icon = THEME_ICON[id] ?? MessageCircle;
  return (
    <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl bg-surface-brand text-accent", className)}>
      <Icon className="size-[18px]" aria-hidden />
    </span>
  );
}

/** Card padrão da área: fundo, borda e sombra sutis (briefing §22). */
export function InsightCard({
  id,
  className,
  children,
  as: Tag = "section",
  labelledBy,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
  as?: "section" | "div";
  labelledBy?: string;
}) {
  return (
    <Tag
      id={id}
      aria-labelledby={labelledBy}
      className={cn("scroll-mt-24 rounded-2xl border border-line bg-bg-elev p-6 shadow-[0_1px_2px_rgba(13,15,26,.04)]", className)}
    >
      {children}
    </Tag>
  );
}

const BADGE = {
  positivo: "bg-sucesso/10 text-sucesso",
  neutro: "bg-aviso/15 text-aviso",
  negativo: "bg-erro/10 text-erro",
} as const;

const SENTIMENT_LABEL = { positivo: "Positivo", neutro: "Neutro", negativo: "Negativo" } as const;

/** Um comentário com o emoji do sentimento, temas, quando e o selo de sentimento. */
export function CommentItem({ c, compact }: { c: FeedbackComment; compact?: boolean }) {
  const s = c.sentiment;
  return (
    <article className={cn("rounded-2xl border border-line bg-bg-elev transition hover:border-line-strong", compact ? "p-4" : "p-5")}>
      <div className="flex gap-3.5">
        {s ? (
          // eslint-disable-next-line @next/next/no-img-element -- emoji decorativo (asset estático)
          <img src={SENTIMENT_EMOJI[s]} alt="" width={40} height={40} className="size-10 shrink-0" />
        ) : (
          <span className="size-10 shrink-0 rounded-full bg-bg-sunken" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-relaxed text-fg-soft">“{c.text}”</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-fg-mut">
            <span>{c.when}</span>
            {c.themes.map((t) => (
              <span key={t} className="rounded-md bg-bg-sunken px-2 py-0.5 font-medium text-fg-soft">
                {t}
              </span>
            ))}
            {s && <span className={cn("ml-auto rounded-full px-2.5 py-0.5 font-semibold", BADGE[s])}>{SENTIMENT_LABEL[s]}</span>}
          </div>
        </div>
      </div>
    </article>
  );
}
