import { Info } from "lucide-react";
import { DataFilters } from "@/components/ui/DataFilters";
import { InsightsExperience } from "@/components/insights/InsightsExperience";
import { InsightsHeader } from "@/components/insights/InsightsHeader";
import { askInsightsAction } from "./actions";
import { InsightsSummary } from "@/components/insights/InsightsSummary";
import { SatisfactionCard } from "@/components/insights/SatisfactionCard";
import { SentimentEvolution } from "@/components/insights/SentimentEvolution";
import { TopTopics } from "@/components/insights/TopTopics";
import { WhatChanged } from "@/components/insights/WhatChanged";
import { Recommendations } from "@/components/insights/Recommendations";
import { FeaturedComments } from "@/components/insights/FeaturedComments";
import { InsightEmptyState } from "@/components/insights/InsightEmptyState";
import { getInsights } from "@/lib/insights/service";
import { listSurveyOptions } from "@/lib/db/surveys";
import { listHosts } from "@/lib/db/hosts";
import { getCurrentProjectId, requireUser } from "@/lib/auth/current";
import { getUserById } from "@/lib/db/users";
import { normalizeHost } from "@/lib/hosts";
import { periodLabel } from "@/lib/period";

export const dynamic = "force-dynamic";

/** Mínimo de respostas para a análise ter algo a dizer. */
const MIN_RESPONSES = 5;

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string; surveyId?: string; host?: string }>;
}) {
  const sp = await searchParams;
  const [projectId, session] = await Promise.all([getCurrentProjectId(), requireUser()]);
  const host = normalizeHost(sp.host) || undefined;
  // padrões de tema pedem volume: por padrão a análise olha TODAS as pesquisas do projeto
  const surveyId = sp.surveyId && sp.surveyId !== "all" ? sp.surveyId : undefined;

  const [data, surveyOptions, hosts, me] = await Promise.all([
    getInsights({ projectId, surveyId, host, period: sp.period, from: sp.from, to: sp.to }),
    listSurveyOptions(projectId, host),
    listHosts(projectId),
    getUserById(session.userId),
  ]);
  const label = periodLabel(sp.period, sp.from, sp.to).toLowerCase();
  const filtersSlot = <DataFilters surveys={surveyOptions} defaultSurveyId="all" hosts={hosts} />;

  if (data.totalResponses < MIN_RESPONSES) {
    return (
      <div className="flex flex-col gap-6">
        <InsightsHeader periodLabel={label} />
        {filtersSlot}
        <InsightEmptyState />
      </div>
    );
  }

  return (
    // remonta ao trocar filtros: uma conversa sobre outro recorte começaria com dados errados
    <InsightsExperience
      key={JSON.stringify(sp)}
      data={data}
      user={{ name: session.name, avatarUrl: me?.avatarUrl ?? null }}
      filters={{ period: sp.period, from: sp.from, to: sp.to, surveyId: sp.surveyId, host }}
      filtersSlot={filtersSlot}
      ask={askInsightsAction}
    >

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <InsightsSummary summary={data.summary} periodLabel={label} />
            <SatisfactionCard s={data.satisfaction} />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <SentimentEvolution data={data} />
            <TopTopics topics={data.topics} base={data.classifiedComments} />
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3">
            <WhatChanged changes={data.changes} topics={data.topics} hasPrevious={data.hasPrevious} />
            <Recommendations items={data.recommendations} />
            <FeaturedComments items={data.featuredComments} />
          </div>

          <p className="flex items-start gap-2 text-xs leading-relaxed text-fg-mut">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Como chegamos aqui: {data.totalResponses.toLocaleString("pt-BR")} respostas e {data.totalComments.toLocaleString("pt-BR")} comentários dos {label}.
            Os temas são reconhecidos pelas palavras usadas nos comentários e cada recomendação mostra as evidências por trás dela.
          </p>
    </InsightsExperience>
  );
}
