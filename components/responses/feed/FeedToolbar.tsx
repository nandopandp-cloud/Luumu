"use client";

import { useEffect, useRef, useState } from "react";
import Link from "@/components/ui/Link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Clock,
  Frown,
  Meh,
  MessageSquareText,
  MessagesSquare,
  Smile,
  SortDesc,
  TextQuote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FeedSort, FeedView, ViewCounts } from "@/lib/db/response-feed";

export const SORT_OPTIONS: { value: FeedSort; label: string; icon: React.ReactNode }[] = [
  { value: "recent", label: "Mais recentes", icon: <Clock className="size-4" /> },
  { value: "oldest", label: "Mais antigos", icon: <ArrowUp className="size-4" /> },
  { value: "score_desc", label: "Nota (maior primeiro)", icon: <ArrowDown className="size-4" /> },
  { value: "score_asc", label: "Nota (menor primeiro)", icon: <ArrowUp className="size-4" /> },
  { value: "comments_first", label: "Comentários primeiro", icon: <MessageSquareText className="size-4" /> },
  { value: "longest", label: "Comentários mais longos", icon: <TextQuote className="size-4" /> },
  { value: "negative_first", label: "Sentimento (mais negativos)", icon: <Frown className="size-4" /> },
  { value: "positive_first", label: "Sentimento (mais positivos)", icon: <Smile className="size-4" /> },
];

/** Monta a URL atual trocando alguns parâmetros (e voltando a paginação ao início). */
function useHref() {
  const pathname = usePathname();
  const params = useSearchParams();
  return (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("limit");
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };
}

/** "Ordenar por": menu com as ordenações (feitas no banco, não só na página atual). */
export function SortMenu({ value }: { value: FeedSort }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const href = useHref();
  const router = useRouter();
  const current = SORT_OPTIONS.find((o) => o.value === value) ?? SORT_OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "flex min-w-[230px] items-center gap-2.5 rounded-xl border bg-bg-elev px-3 py-1.5 text-left transition",
          open ? "border-accent shadow-[0_0_0_3px_var(--surface-brand)]" : "border-line-strong hover:border-accent"
        )}
      >
        <SortDesc className="size-4 shrink-0 text-accent" />
        <span className="min-w-0 flex-1">
          <span className="block text-[10.5px] font-semibold text-fg-mut">Ordenar por</span>
          <span className="block truncate text-sm font-semibold">{current.label}</span>
        </span>
        <ChevronDown className={cn("size-4 text-fg-mut transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1.5 w-[270px] overflow-hidden rounded-xl border border-line bg-bg-elev py-1.5 shadow-[var(--shadow-lg)]"
        >
          {SORT_OPTIONS.map((o) => {
            const on = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                role="menuitemradio"
                aria-checked={on}
                onClick={() => {
                  setOpen(false);
                  router.push(href({ sort: o.value === "recent" ? null : o.value }), { scroll: false });
                }}
                className={cn(
                  "mx-1.5 flex w-[calc(100%-12px)] items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm",
                  on ? "bg-surface-brand font-semibold text-accent" : "text-fg-soft hover:bg-bg-sunken"
                )}
              >
                <span className={on ? "text-accent" : "text-fg-mut"}>{o.icon}</span>
                <span className="flex-1">{o.label}</span>
                {on && <Check className="size-4" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const VIEWS: { value: FeedView; label: string; icon: React.ReactNode; tone: string }[] = [
  { value: "all", label: "Todas", icon: <MessagesSquare className="size-4" />, tone: "text-fg-mut" },
  { value: "comments", label: "Com comentário", icon: <MessageSquareText className="size-4" />, tone: "text-accent" },
  { value: "positive", label: "Positivas", icon: <Smile className="size-4" />, tone: "text-sucesso" },
  { value: "negative", label: "Negativas", icon: <Frown className="size-4" />, tone: "text-erro" },
  { value: "neutral", label: "Neutras", icon: <Meh className="size-4" />, tone: "text-aviso" },
];

/** Abas do feed com a contagem de cada uma (no recorte dos filtros). */
export function ViewTabs({ value, counts }: { value: FeedView; counts: ViewCounts }) {
  const href = useHref();
  const n: Record<FeedView, number> = {
    all: counts.all,
    comments: counts.comments,
    positive: counts.positive,
    negative: counts.negative,
    neutral: counts.neutral,
  };
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Filtrar respostas">
      {VIEWS.map((v) => {
        const on = v.value === value;
        return (
          <Link
            key={v.value}
            href={href({ view: v.value === "all" ? null : v.value })}
            scroll={false}
            aria-current={on ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition",
              on ? "border-accent bg-surface-brand text-accent" : "border-line bg-bg-elev text-fg-soft hover:border-line-strong"
            )}
          >
            <span className={on ? "text-accent" : v.tone}>{v.icon}</span>
            {v.label}
            <span className={cn("font-mono text-xs", on ? "text-accent" : "text-fg-mut")}>({n[v.value].toLocaleString("pt-BR")})</span>
          </Link>
        );
      })}
    </nav>
  );
}

