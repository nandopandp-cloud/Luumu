"use client";

import { useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp, ChevronRight, Minus, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sparkline } from "@/components/ui/InsightCard";
import type { AnswerVisual as Visual, InsightsData, Recommendation, TopicInsight } from "@/lib/insights/types";
import { CommentItem, ThemeIcon } from "../shared";
import { SentimentLegend } from "../SentimentLegend";
import { TopicDrawer } from "../TopicDrawer";
import { EvidenceDrawer } from "../Recommendations";

export type SectionAnchor = "summary" | "evolution" | "topics" | "changes" | "recommendations" | "comments";

/** Bloco visual "ao lado" do texto (compacto) ou "abaixo" dele (listas). */
export const SIDE_VISUALS: Visual[] = ["satisfaction"];

function DetailsButton({ onClick, label = "Ver detalhes" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-surface-brand px-4 py-2.5 text-sm font-bold text-accent transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
    >
      {label} <ArrowRight className="size-4" />
    </button>
  );
}

function SatisfactionVisual({ data, onSection }: { data: InsightsData; onSection: (a: SectionAnchor) => void }) {
  const s = data.satisfaction;
  if (!s) return null;
  const d = s.delta;
  const good = d ? (d.inverted ? d.value < 0 : d.value > 0) : false;
  return (
    <div>
      <div className="rounded-2xl border border-line bg-bg-elev p-4">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-surface-brand text-accent">
            <Star className="size-4" aria-hidden />
          </span>
          <span className="text-sm font-semibold text-fg-soft">{s.label}</span>
        </div>
        <div className="mt-3 flex items-end justify-between gap-4">
          <div>
            <div className="font-display text-[32px] font-extrabold leading-none tracking-tight">{s.value}</div>
            {d ? (
              <div className="mt-2 text-xs">
                <span className={cn("inline-flex items-center gap-0.5 font-bold", Math.abs(d.value) < 0.05 ? "text-fg-mut" : good ? "text-sucesso" : "text-erro")}>
                  {Math.abs(d.value) < 0.05 ? <Minus className="size-3.5" /> : d.value > 0 ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
                  {Math.abs(d.value).toLocaleString("pt-BR")} {d.unit}
                </span>
                <div className="text-fg-mut">vs. período anterior</div>
              </div>
            ) : (
              <div className="mt-2 text-xs text-fg-mut">Sem período anterior</div>
            )}
          </div>
          <div className="relative w-[150px]">
            <Sparkline values={s.trend} tone="roxo" className="h-16 w-[150px]" />
            {s.trend.length > 1 && (
              <span className="absolute -top-5 right-0 rounded-md border border-line bg-bg-elev px-1.5 py-0.5 text-[10px] font-bold text-accent">
                {s.trend[s.trend.length - 1]}
                {s.value.endsWith("%") ? "%" : ""}
              </span>
            )}
          </div>
        </div>
      </div>
      <DetailsButton onClick={() => onSection("evolution")} />
    </div>
  );
}

function TopicsVisual({ data, onSection }: { data: InsightsData; onSection: (a: SectionAnchor) => void }) {
  const [open, setOpen] = useState<TopicInsight | null>(null);
  const top = data.topics.slice(0, 5);
  const max = Math.max(1, ...top.map((t) => t.pct));
  if (!top.length) return null;
  return (
    <div className="rounded-2xl border border-line bg-bg-elev p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-bold">Temas mais citados</span>
        <button type="button" onClick={() => onSection("topics")} className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
          Ver todos os temas <ArrowRight className="size-3.5" />
        </button>
      </div>
      <ul>
        {top.map((t) => (
          <li key={t.id}>
            <button type="button" onClick={() => setOpen(t)} className="group flex w-full items-center gap-3 rounded-xl px-1.5 py-2 text-left hover:bg-bg-sunken">
              <ThemeIcon id={t.id} className="size-8" />
              <span className="min-w-0 flex-1 text-sm font-semibold">{t.label}</span>
              <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-bg-sunken sm:block">
                <span className="block h-full rounded-full [background:var(--grad-roxo)]" style={{ width: `${(t.pct / max) * 100}%` }} />
              </span>
              <span className="w-10 text-right text-sm font-semibold text-fg-soft">{t.pct}%</span>
              <ChevronRight className="size-4 text-fg-mut group-hover:text-accent" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      {open && <TopicDrawer topic={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function ChangesVisual({ data, onSection }: { data: InsightsData; onSection: (a: SectionAnchor) => void }) {
  if (!data.changes.length) return null;
  return (
    <div className="rounded-2xl border border-line bg-bg-elev p-4">
      <ul className="flex flex-col gap-1">
        {data.changes.slice(0, 5).map((c) => (
          <li key={c.id} className="flex items-center gap-3 py-1.5">
            <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", c.good ? "bg-sucesso/10 text-sucesso" : "bg-erro/10 text-erro")}>
              {c.good ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{c.label}</span>
              <span className="block text-xs text-fg-mut">{c.description}</span>
            </span>
            <span className={cn("text-sm font-bold", c.good ? "text-sucesso" : "text-erro")}>
              {c.change > 0 ? "+" : ""}
              {c.change}%
            </span>
          </li>
        ))}
      </ul>
      <DetailsButton onClick={() => onSection("changes")} label="Comparar períodos" />
    </div>
  );
}

function RecommendationsVisual({ data }: { data: InsightsData }) {
  const [open, setOpen] = useState<Recommendation | null>(null);
  if (!data.recommendations.length) return null;
  return (
    <div className="flex flex-col gap-2">
      {data.recommendations.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => setOpen(r)}
          className="group flex items-start gap-3 rounded-2xl border border-line bg-bg-elev p-3.5 text-left transition hover:border-accent/40"
        >
          <ThemeIcon id={r.themeId} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">{r.title}</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-fg-mut">{r.description}</span>
            <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-accent">
              Ver evidências <ChevronRight className="size-3.5 transition group-hover:translate-x-0.5" />
            </span>
          </span>
        </button>
      ))}
      {open && <EvidenceDrawer rec={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** Desenha o bloco pedido pela resposta — sempre com os dados reais da página. */
export function AnswerVisual({ visual, data, onSection }: { visual: Visual; data: InsightsData; onSection: (a: SectionAnchor) => void }) {
  switch (visual) {
    case "satisfaction":
      return <SatisfactionVisual data={data} onSection={onSection} />;
    case "topics":
      return <TopicsVisual data={data} onSection={onSection} />;
    case "changes":
      return <ChangesVisual data={data} onSection={onSection} />;
    case "recommendations":
      return <RecommendationsVisual data={data} />;
    case "sentiment":
      return <SentimentLegend items={data.sentimentDistribution} />;
    case "comments":
      return data.featuredComments.length ? (
        <div className="flex flex-col gap-2">
          {data.featuredComments.map((c) => (
            <CommentItem key={c.id} c={c} compact />
          ))}
        </div>
      ) : null;
    default:
      return null;
  }
}
