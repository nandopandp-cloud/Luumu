import { PageHeader } from "@/components/ui/PageHeader";
import { selectedPlatform } from "@/lib/platform";
import { DataFilters } from "@/components/ui/DataFilters";
import { ExportPanel } from "@/components/reports/ExportPanel";
import { ScheduleReports, type ScheduledItem } from "@/components/reports/ScheduleReports";
import { PublicLinks, type PublicLinkItem } from "@/components/reports/PublicLinks";
import { getCurrentProjectId } from "@/lib/auth/current";
import { listSurveys, listSurveyOptions, resolveSurveyScope } from "@/lib/db/surveys";
import { getStats } from "@/lib/db/responses";
import { listScheduledReports, listPublicReports } from "@/lib/db/reports";
import { periodLabel, periodToRange } from "@/lib/period";

export const dynamic = "force-dynamic";

/** Relatórios abrem em "Todo o período" (o resumo completo), não em "Hoje". */
const REPORTS_DEFAULT_PERIOD = "all";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ surveyId?: string; period?: string; from?: string; to?: string; host?: string }>;
}) {
  const { surveyId, period, from, to, host: hostParam } = await searchParams;
  const projectId = await getCurrentProjectId();
  const host = await selectedPlatform(projectId, hostParam);
  const { from: dateFrom, to: dateTo } = periodToRange(period ?? REPORTS_DEFAULT_PERIOD, from, to);
  // sem filtro na URL, abre já na última pesquisa vigente/criada (da plataforma, se filtrada)
  const { surveyId: scopedSurveyId, defaultSurveyId } = await resolveSurveyScope(projectId, surveyId, host);

  const [surveys, filterOptions, stats, scheduled, publicLinks] = await Promise.all([
    listSurveys(projectId),
    listSurveyOptions(projectId, host),
    // contagem do recorte exato que a exportação vai baixar (mesmos filtros do topo)
    getStats({ projectId, surveyId: scopedSurveyId, dateFrom, dateTo, host }),
    listScheduledReports(projectId),
    listPublicReports(projectId),
  ]);

  const scopedSurveyName = scopedSurveyId
    ? surveys.find((s) => s.id === scopedSurveyId)?.name ?? "Pesquisa"
    : "Todas as pesquisas";

  // agendamento/links: todas as pesquisas (você pode agendar antes de ter resposta)
  const surveyOpts = surveys.map((s) => ({ id: s.id, name: s.name }));

  // tipos acompanháveis: só os que existem no projeto e têm alguma campanha com data de fim
  // (sem vigência não há ciclo a fechar, então não há "última campanha encerrada" a resolver)
  const surveyTypeOpts = Array.from(
    new Set(surveys.filter((s) => s.endsAt).map((s) => s.type))
  ).sort();

  const scheduledItems: ScheduledItem[] = scheduled.map((s) => ({
    id: s.id,
    name: s.name,
    recipients: (s.recipients as string[]) ?? [],
    frequency: s.frequency,
    period: s.period,
    format: s.format,
    surveyIds: (s.surveyIds as string[]) ?? [],
    surveyTypes: (s.surveyTypes as string[]) ?? [],
    active: s.active,
    nextRunAt: s.nextRunAt.toISOString(),
    lastRunAt: s.lastRunAt ? s.lastRunAt.toISOString() : null,
  }));

  const linkItems: PublicLinkItem[] = publicLinks.map((l) => ({
    id: l.id,
    token: l.token,
    surveyId: l.surveyId,
    period: l.period,
    active: l.active,
    viewCount: l.viewCount,
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Inteligência"
        title="Relatórios"
        description="Exporte, agende e compartilhe seus dados no formato ideal para cada público."
      />

      <div className="mb-4">
        <DataFilters surveys={filterOptions} defaultSurveyId={defaultSurveyId} defaultPeriod={REPORTS_DEFAULT_PERIOD} />
      </div>

      {/* Export manual */}
      <div className="mb-4">
        <ExportPanel
          count={stats.total}
          surveyId={scopedSurveyId}
          surveyName={scopedSurveyName}
          host={host}
          periodText={periodLabel(period ?? REPORTS_DEFAULT_PERIOD, from, to)}
          period={period ?? REPORTS_DEFAULT_PERIOD}
          from={from}
          to={to}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ScheduleReports surveys={surveyOpts} surveyTypes={surveyTypeOpts} initial={scheduledItems} />
        <PublicLinks surveys={surveyOpts} initial={linkItems} />
      </div>
    </div>
  );
}
