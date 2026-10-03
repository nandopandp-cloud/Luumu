import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { FeedbackComment } from "@/lib/insights/types";
import { CommentItem, InsightCard } from "./shared";

/** Comentários em destaque: um elogio e uma crítica representativos do período. */
export function FeaturedComments({ items }: { items: FeedbackComment[] }) {
  return (
    <InsightCard id="comments" labelledBy="featured-title" className="h-full">
      <div className="flex items-center justify-between gap-3">
        <h2 id="featured-title" className="font-display text-xl font-bold tracking-tight">
          Comentários em destaque
        </h2>
        <Link
          href="/responses?view=comments"
          className="inline-flex items-center gap-1 rounded-xl border border-line px-3 py-1.5 text-xs font-semibold text-fg-soft transition hover:border-accent hover:text-accent"
        >
          Ver todos <ChevronRight className="size-3.5" />
        </Link>
      </div>
      <div className="mt-4 flex flex-col gap-3">
        {items.length ? items.map((c) => <CommentItem key={c.id} c={c} />) : <p className="text-sm text-fg-mut">Ainda não há comentários neste período.</p>}
      </div>
    </InsightCard>
  );
}
