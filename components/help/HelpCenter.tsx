"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "@/components/ui/Link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRight,
  ChevronDown,
  ClipboardList,
  Code2,
  Crown,
  Flame,
  MessageSquare,
  Plug,
  Rocket,
  Route,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Mascot } from "@/components/ui/Mascot";
import { highlight } from "@/lib/search/core";
import { HELP, HELP_EXAMPLES, searchHelp, type HelpArticle, type HelpCategory } from "@/lib/help/articles";

const ICON: Record<string, LucideIcon> = {
  rocket: Rocket,
  surveys: ClipboardList,
  responses: MessageSquare,
  route: Route,
  sparkles: Sparkles,
  flame: Flame,
  plug: Plug,
  code: Code2,
  settings: Settings,
  crown: Crown,
  shield: ShieldCheck,
  wrench: Wrench,
};

function Hl({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  // destaca cada palavra da busca (com 3+ letras)
  const words = q.split(/\s+/).filter((w) => w.length >= 3);
  let parts: { text: string; match: boolean }[] = [{ text, match: false }];
  for (const w of words) {
    parts = parts.flatMap((p) => (p.match ? [p] : highlight(p.text, w)));
  }
  return (
    <>
      {parts.map((p, i) =>
        p.match ? (
          <mark key={i} className="rounded bg-accent/15 px-0.5 text-accent">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </>
  );
}

/** Resposta: parágrafos (linha em branco) e listas ("- " no começo da linha). */
function Answer({ text, q }: { text: string; q: string }) {
  return (
    <div className="flex flex-col gap-2.5 text-[14.5px] leading-relaxed text-fg-soft">
      {text.split(/\n\n+/).map((block, i) => {
        const lines = block.split("\n");
        if (lines.every((l) => l.startsWith("- "))) {
          return (
            <ul key={i} className="flex flex-col gap-1.5 pl-1">
              {lines.map((l, j) => (
                <li key={j} className="flex gap-2">
                  <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-accent/60" />
                  <span>
                    <Hl text={l.slice(2)} q={q} />
                  </span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            <Hl text={block} q={q} />
          </p>
        );
      })}
    </div>
  );
}

function ArticleItem({
  article,
  category,
  open,
  onToggle,
  q,
  showCategory,
}: {
  article: HelpArticle;
  category: HelpCategory;
  open: boolean;
  onToggle: () => void;
  q: string;
  showCategory?: boolean;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  // artigo aberto por link (?a=): rola até ele
  useEffect(() => {
    if (open && !showCategory) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    // só na montagem: depois o usuário controla
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div ref={ref} className={cn("border-b border-line last:border-b-0", open && "bg-surface-brand/25")}>
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-bg-sunken/50"
        >
          <span className="min-w-0">
            {showCategory && <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-accent">{category.title}</span>}
            <span className="block text-[15px] font-semibold text-fg">
              <Hl text={article.q} q={q} />
            </span>
          </span>
          <ChevronDown className={cn("size-5 shrink-0 text-fg-mut transition-transform duration-200", open && "rotate-180 text-accent")} aria-hidden />
        </button>
      </h3>
      {open && (
        <div id={id} role="region" className="px-5 pb-5 animate-[luumuFade_.2s_ease-out]">
          <Answer text={article.a} q={q} />
          {article.link && (
            <Link
              href={article.link.href}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-surface-brand px-3.5 py-2 text-sm font-semibold text-accent transition hover:brightness-95"
            >
              {article.link.label} <ArrowRight className="size-4" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

/** Central de Ajuda: busca, categorias e artigos em accordion. Estado espelhado na URL (?c, ?q, ?a). */
export function HelpCenter({ initialCategory, initialQuery, initialArticle }: { initialCategory?: string; initialQuery?: string; initialArticle?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const fromArticle = initialArticle ? HELP.find((c) => c.articles.some((a) => a.id === initialArticle)) : undefined;
  const [catId, setCatId] = useState(fromArticle?.id ?? HELP.find((c) => c.id === initialCategory)?.id ?? HELP[0].id);
  const [query, setQuery] = useState(initialQuery ?? "");
  const [openId, setOpenId] = useState<string | null>(initialArticle ?? HELP.find((c) => c.id === (fromArticle?.id ?? initialCategory))?.articles[0].id ?? HELP[0].articles[0].id);
  const inputRef = useRef<HTMLInputElement>(null);

  const term = query.trim();
  const hits = useMemo(() => (term.length >= 2 ? searchHelp(term) : null), [term]);
  const category = HELP.find((c) => c.id === catId) ?? HELP[0];

  // URL compartilhável, sem encher o histórico
  useEffect(() => {
    const t = window.setTimeout(() => {
      const p = new URLSearchParams();
      if (term) p.set("q", term);
      else p.set("c", catId);
      if (openId) p.set("a", openId);
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    }, 250);
    return () => window.clearTimeout(t);
  }, [term, catId, openId, pathname, router]);

  function pickCategory(id: string) {
    setQuery("");
    setCatId(id);
    setOpenId(HELP.find((c) => c.id === id)?.articles[0].id ?? null);
  }

  const toggle = (id: string) => setOpenId((cur) => (cur === id ? null : id));

  return (
    <div className="flex flex-col gap-7">
      {/* topo */}
      <header className="relative grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0">
          <span className="inline-flex rounded-md bg-surface-brand px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-accent">Ajuda</span>
          <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight md:text-[36px] md:leading-tight">Como podemos ajudar?</h1>
          <p className="mt-1.5 text-[15px] text-fg-mut">Encontre respostas, tutoriais e tudo o que você precisa para aproveitar o máximo da Luumu.</p>

          <form
            role="search"
            onSubmit={(e) => e.preventDefault()}
            className="mt-6 flex items-center gap-3 rounded-2xl border border-accent/30 bg-bg-elev px-5 py-3.5 shadow-[0_8px_30px_rgba(107,43,217,.08)] transition focus-within:border-accent/60 focus-within:shadow-[0_0_0_4px_rgba(107,43,217,.10),0_8px_30px_rgba(107,43,217,.10)]"
          >
            <Search className="size-5 shrink-0 text-fg-mut" aria-hidden />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar no FAQ…"
              aria-label="Buscar no FAQ"
              maxLength={80}
              className="min-w-0 flex-1 bg-transparent text-[16px] text-fg outline-none placeholder:text-fg-mut"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                aria-label="Limpar busca"
                className="grid size-7 place-items-center rounded-full text-fg-mut transition hover:bg-bg-sunken hover:text-fg"
              >
                <X className="size-4" />
              </button>
            )}
          </form>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-fg-mut">Exemplos:</span>
            {HELP_EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => {
                  setQuery(ex);
                  setOpenId(searchHelp(ex)[0]?.article.id ?? null);
                }}
                className="rounded-full border border-line bg-bg-elev px-3.5 py-1.5 text-sm text-fg-soft transition hover:border-accent/50 hover:text-accent"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
        <div className="relative hidden justify-center lg:flex" aria-hidden>
          <Mascot name="Pensativo" size={190} float />
          <span className="absolute -top-2 right-2 grid size-16 place-items-center rounded-full bg-bg-elev font-display text-4xl font-extrabold text-accent shadow-[0_10px_30px_rgba(107,43,217,.18)]">
            ?
            <span className="absolute -bottom-1 left-2 size-4 rotate-45 bg-bg-elev" />
          </span>
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* categorias */}
        <nav aria-label="Categorias" className="rounded-2xl border border-line bg-bg-elev p-4 lg:sticky lg:top-20">
          <h2 className="px-2 pb-3 pt-1 font-display text-lg font-bold">Categorias</h2>
          <ul className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0">
            {HELP.map((c) => {
              const Icon = ICON[c.icon] ?? Rocket;
              const active = !hits && c.id === category.id;
              return (
                <li key={c.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => pickCategory(c.id)}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition",
                      active ? "bg-surface-brand font-semibold text-accent" : "text-fg-soft hover:bg-bg-sunken"
                    )}
                  >
                    <Icon className="size-[18px] shrink-0" aria-hidden />
                    <span className="flex-1 whitespace-nowrap">{c.title}</span>
                    <span className={cn("text-xs tabular-nums", active ? "text-accent" : "text-fg-mut")}>{c.articles.length}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* artigos */}
        <section aria-live="polite" className="rounded-2xl border border-line bg-bg-elev p-6">
          {hits ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-bold tracking-tight">Resultados para “{term}”</h2>
                  <p className="mt-0.5 text-sm text-fg-mut">
                    {hits.length ? `${hits.length} ${hits.length === 1 ? "artigo encontrado" : "artigos encontrados"} em todas as categorias.` : "Tente outras palavras ou navegue pelas categorias."}
                  </p>
                </div>
              </div>
              {hits.length ? (
                <div className="mt-5 overflow-hidden rounded-xl border border-line">
                  {hits.slice(0, 20).map(({ article, category: c }) => (
                    <ArticleItem key={`${c.id}-${article.id}`} article={article} category={c} q={term} open={openId === article.id} onToggle={() => toggle(article.id)} showCategory />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center py-12 text-center">
                  <Mascot name="Preocupado" size={110} />
                  <p className="mt-3 font-display font-bold">Não encontramos nada sobre isso</p>
                  <p className="mt-1 max-w-sm text-sm text-fg-mut">Experimente palavras mais curtas, como “pesquisa”, “SDK” ou “plano”.</p>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-bold tracking-tight">{category.title}</h2>
                  <p className="mt-0.5 text-sm text-fg-mut">{category.subtitle}</p>
                </div>
                <span className="rounded-full bg-bg-sunken px-3 py-1 text-xs font-medium text-fg-mut">
                  {category.articles.length} {category.articles.length === 1 ? "artigo" : "artigos"}
                </span>
              </div>
              <div key={category.id} className="mt-5 overflow-hidden rounded-xl border border-line animate-[luumuFade_.2s_ease-out]">
                {category.articles.map((a) => (
                  <ArticleItem key={a.id} article={a} category={category} q="" open={openId === a.id} onToggle={() => toggle(a.id)} />
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
