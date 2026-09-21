import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { DataFilters } from "@/components/ui/DataFilters";
import { periodToRange } from "@/lib/period";
import { ResponsesView, type ResponseItem } from "@/components/responses/ResponsesView";
import { ExportMenu } from "@/components/responses/ExportMenu";
import { listResponses, getStats, getScoreDistribution, getWordCloud, getMainScore } from "@/lib/db/responses";
import { listSurveyOptions, resolveSurveyScope } from "@/lib/db/surveys";
import { getCurrentProjectId } from "@/lib/auth/current";
import { timeAgo } from "@/lib/utils";
import { formatScore } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export default async function ResponsesPage({
  searchParams,
}: {
  searchParams: Promise<{ surveyId?: string; period?: string; from?: string; to?: string }>;
}) {
  const { surveyId, period, from, to } = await searchParams;
  const projectId = await getCurrentProjectId();
  const { from: dateFrom, to: dateTo } = periodToRange(period, from, to);
  // sem filtro na URL, abre já na última pesquisa vigente/criada
  const { surveyId: scopedSurveyId, defaultSurveyId } = await resolveSurveyScope(projectId, surveyId);
  const scope = { projectId, surveyId: scopedSurveyId, dateFrom, dateTo };

  const [rows, stats, distribution, wordCloud, surveyOptions, mainScore] = await Promise.all([
    listResponses(scope),
    getStats(scope),
    getScoreDistribution(scope),
    getWordCloud(scope),
    listSurveyOptions(projectId),
    getMainScore(scope),
  ]);

  const items: ResponseItem[] = rows.map((r) => ({
    id: r.id,
    user: r.respondentEmail ?? r.respondent ?? "Anônimo",
    channel: r.channel,
    when: timeAgo(r.createdAt),
    sentiment: r.sentiment as ResponseItem["sentiment"],
    score: r.score,
    comment: r.comment,
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Respostas"
        title="Respostas"
        description="A voz dos seus clientes, agregada de todas as pesquisas, com sentimento e temas."
        actions={<ExportMenu surveyId={scopedSurveyId} />}
      />

      <div className="mb-4">
        <DataFilters surveys={surveyOptions} defaultSurveyId={defaultSurveyId} />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Total de respostas" value={stats.total} accent="roxo" />
        <MetricCard label="Sentimento positivo" value={`${stats.positivePct}%`} accent="verde" />
        <MetricCard
          label={mainScore?.surveyName ? `${mainScore.label} · ${mainScore.surveyName}` : mainScore?.label ?? "Score"}
          value={mainScore ? formatScore(mainScore) : "—"}
          accent="azul"
          hint={mainScore ? mainScore.formula : undefined}
        />
        <MetricCard label="Com comentário" value={items.filter((i) => i.comment).length} accent="laranja" />
      </div>

      <ResponsesView responses={items} distribution={distribution} total={stats.total} wordCloud={wordCloud} />
    </div>
  );
}
