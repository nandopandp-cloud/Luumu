"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import type { Recommendation } from "@/lib/insights/types";
import { CommentItem, InsightCard, ThemeIcon } from "./shared";

/** Evidências de uma recomendação: números e os comentários reais que a sustentam. */
export function EvidenceDrawer({ rec, onClose }: { rec: Recommendation; onClose: () => void }) {
  const ev = rec.evidence;
  return (
    <Drawer title="Evidências" subtitle={rec.title} onClose={onClose}>
      <div className="rounded-2xl bg-surface-brand/60 p-4">
        <div className="font-display text-3xl font-extrabold text-accent">{ev.analyzed}</div>
        <div className="text-sm font-semibold text-fg-soft">{ev.analyzed === 1 ? "comentário analisado" : "comentários analisados"}</div>
        {ev.facts.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1.5 border-t border-accent/10 pt-3 text-sm text-fg-soft">
            {ev.facts.map((f) => (
              <li key={f.label} className="flex items-center gap-2">
                <span className="w-8 font-mono font-bold text-fg">{f.count}</span>
                {f.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      <h3 className="mt-6 text-sm font-bold">Comentários que sustentam a recomendação</h3>
      <div className="mt-2.5 flex flex-col gap-2.5">
        {ev.comments.length ? (
          ev.comments.map((c) => <CommentItem key={c.id} c={c} compact />)
        ) : (
          <p className="text-sm text-fg-mut">Os comentários deste tema são curtos demais para destacar.</p>
        )}
      </div>
    </Drawer>
  );
}

/** Recomendações acionáveis, cada uma com as evidências por trás dela. */
export function Recommendations({ items }: { items: Recommendation[] }) {
  const [open, setOpen] = useState<Recommendation | null>(null);
  return (
    <InsightCard id="recommendations" labelledBy="recs-title" className="h-full">
      <h2 id="recs-title" className="font-display text-xl font-bold tracking-tight">
        Recomendações da Luumu
      </h2>
      {items.length === 0 ? (
        <p className="mt-6 text-sm text-fg-mut">Nenhum tema concentra críticas ou pedidos suficientes para uma recomendação neste período.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {items.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setOpen(r)}
                className="group flex w-full items-start gap-3.5 rounded-2xl bg-bg-sunken/70 p-4 text-left transition hover:bg-surface-brand/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
              >
                <ThemeIcon id={r.themeId} className="size-10 bg-bg-elev" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-fg">{r.title}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-fg-mut">{r.description}</span>
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent">
                    Ver evidências <ChevronRight className="size-3.5 transition group-hover:translate-x-0.5" />
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && <EvidenceDrawer rec={open} onClose={() => setOpen(null)} />}
    </InsightCard>
  );
}
