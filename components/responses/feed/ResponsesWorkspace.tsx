import Link from "@/components/ui/Link";
import { MessageSquareText, MessagesSquare, Smile, Star, ChevronDown } from "lucide-react";
import { DataFilters } from "@/components/ui/DataFilters";
import { EmptyState } from "@/components/ui/EmptyState";
import { getScoreDistribution, getWordCloud, type Scope } from "@/lib/db/responses";
import { getOverview } from "@/lib/db/overview";
import { getResponseFeed, FEED_SORTS, FEED_VIEWS, type FeedSort, type FeedView } from "@/lib/db/response-feed";
import { formatScore } from "@/lib/scoring";
import { timeAgo } from "@/lib/utils";
import { isDeviceKind } from "@/lib/device";
import type { WordCloudItem } from "@/lib/wordcloud";
import { InsightCard, pctDelta, scoreDelta } from "@/components/ui/InsightCard";
import { SortMenu, ViewTabs } from "./FeedToolbar";
import { ResponseCard, type ResponseCardData } from "./ResponseCard";
import { ScoreDistributionCard, WordsCard } from "./SideCards";

export interface WorkspaceParams {
  view?: string;
  sort?: string;
  limit?: string;
}

const PAGE = 30;
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const shortDate = (d: Date) => `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

const key = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");

/** Temas de um comentário: as palavras mais citadas do recorte que aparecem nele (até 3). */
function tagsFor(comment: string, words: WordCloudItem[]): string[] {
  if (!comment) return [];
  const tokens = new Set(key(comment).split(/[^\p{L}\p{N}]+/u));
  return words.filter((w) => tokens.has(key(w.text))).slice(0, 3).map((w) => w.text);
}

/**
 * Tela de respostas completa (filtros, métricas, abas, feed e lateral). Usada em /responses e
 * em /surveys/[id]/responses. Ordenação, abas e paginação vêm da URL e rodam no banco.
 */
export async function ResponsesWorkspace({
  scope,
  params,
  hosts,
  surveyFilter,
  hrefBase,
}: {
  scope: Scope;
  params: WorkspaceParams;
  hosts: string[];
  /** seletor de pesquisa no topo (só na tela geral) */
  surveyFilter?: { options: { id: string; name: string }[]; defaultSurveyId?: string };
  hrefBase: string;
}) {
  const view: FeedView = (FEED_VIEWS as readonly string[]).includes(params.view ?? "") ? (params.view as FeedView) : "all";
  const sort: FeedSort = (FEED_SORTS as readonly string[]).includes(params.sort ?? "") ? (params.sort as FeedSort) : "recent";
  const limit = Math.min(300, Math.max(PAGE, Number(params.limit) || PAGE));
  const [feed, overview, distribution, words] = await Promise.all([
    getResponseFeed(scope, { view, sort, limit }),
    getOverview(scope),
    getScoreDistribution(scope),
    getWordCloud(scope),
  ]);
  const { counts, prevCounts, mainScore, prevScore, positivePct, prevPositivePct } = overview;
  // minigráficos: série diária do período, com zero nos dias sem resposta
  const recent = overview.daily;

  const cards: ResponseCardData[] = feed.items.map((r) => ({
    id: r.id,
    who: r.respondentEmail ?? r.respondent ?? "Anônimo",
    surveyName: r.surveyName,
    showSurvey: !scope.surveyId,
    host: r.host,
    device: isDeviceKind(r.device) ? r.device : null,
    when: timeAgo(r.createdAt),
    date: shortDate(r.createdAt),
    sentiment: r.sentiment,
    score: r.score,
    comment: r.comment,
    tags: tagsFor(r.comment, words),
  }));

  const moreHref = (() => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, limit: String(limit + PAGE) })) if (v) p.set(k, v);
    return `${hrefBase}?${p.toString()}`;
  })();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <DataFilters surveys={surveyFilter?.options} defaultSurveyId={surveyFilter?.defaultSurveyId} defaultPeriod="all" />
        <SortMenu value={sort} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InsightCard
          label="Total de respostas"
          value={counts.all.toLocaleString("pt-BR")}
          tone="roxo"
          icon={<MessagesSquare className="size-5" />}
          series={recent.map((d) => d.total)}
          delta={pctDelta(counts.all, prevCounts?.all)}
        />
        <InsightCard
          label="Sentimento positivo"
          value={`${positivePct}%`}
          tone="verde"
          icon={<Smile className="size-5" />}
          series={recent.map((d) => (d.total ? (d.positive / d.total) * 100 : 0))}
          delta={prevPositivePct != null ? { value: positivePct - prevPositivePct, unit: "p.p." } : null}
        />
        <InsightCard
          label={mainScore ? `${mainScore.label}${mainScore.surveyName ? ` · ${mainScore.surveyName}` : ""}` : "Nota"}
          value={mainScore ? formatScore(mainScore) : "—"}
          tone="azul"
          icon={<Star className="size-5" />}
          chart="bars"
          series={recent.map((d) => d.avgScore ?? 0)}
          delta={scoreDelta(mainScore, prevScore)}
          hint={mainScore?.formula}
        />
        <InsightCard
          label="Comentários"
          value={counts.comments.toLocaleString("pt-BR")}
          tone="laranja"
          icon={<MessageSquareText className="size-5" />}
          series={recent.map((d) => d.comments)}
          delta={pctDelta(counts.comments, prevCounts?.comments)}
        />
      </div>

      <ViewTabs value={view} counts={counts} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-3">
          {cards.length === 0 ? (
            <EmptyState
              mascot="Pensativo"
              title={counts.all === 0 ? "Ainda sem respostas" : "Nada nesta aba"}
              description={
                counts.all === 0
                  ? "Publique uma pesquisa e as respostas aparecem aqui em tempo real."
                  : "Nenhuma resposta corresponde a este filtro. Tente outra aba ou outro período."
              }
            />
          ) : (
            cards.map((r) => <ResponseCard key={r.id} r={r} hosts={hosts} />)
          )}
          {feed.hasMore && (
            <Link
              href={moreHref}
              scroll={false}
              className="mx-auto mt-1 inline-flex items-center gap-1.5 rounded-xl border border-line bg-bg-elev px-4 py-2 text-sm font-semibold text-fg-soft hover:border-accent hover:text-accent"
            >
              <ChevronDown className="size-4" /> Mostrar mais respostas
            </Link>
          )}
        </div>
        <aside className="flex flex-col gap-4">
          <ScoreDistributionCard buckets={distribution.map((b) => ({ label: b.label, value: b.value }))} total={counts.all} />
          <WordsCard words={words} />
        </aside>
      </div>
    </div>
  );
}
