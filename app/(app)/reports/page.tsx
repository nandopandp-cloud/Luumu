import { PageHeader } from "@/components/ui/PageHeader";
import { DataFilters } from "@/components/ui/DataFilters";
import { ExportPanel } from "@/components/reports/ExportPanel";
import { ScheduleReports, type ScheduledItem } from "@/components/reports/ScheduleReports";
import { PublicLinks, type PublicLinkItem } from "@/components/reports/PublicLinks";
import { getCurrentProjectId } from "@/lib/auth/current";
import { listSurveys } from "@/lib/db/surveys";
import { getStats } from "@/lib/db/responses";
import { listScheduledReports, listPublicReports } from "@/lib/db/reports";
import { periodToRange } from "@/lib/period";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const { period, from, to } = await searchParams;
  const projectId = await getCurrentProjectId();
  const { from: dateFrom, to: dateTo } = periodToRange(period, from, to);

  const [surveys, stats, scheduled, publicLinks] = await Promise.all([
    listSurveys(projectId),
    getStats({ projectId, dateFrom, dateTo }),
    listScheduledReports(projectId),
    listPublicReports(projectId),
  ]);

  // export panel: só pesquisas que já têm resposta
  const exportOpts = surveys
    .filter((s) => s.responseCount > 0)
    .map((s) => ({ id: s.id, name: s.name, responseCount: s.responseCount }));

  // agendamento/links: todas as pesquisas (você pode agendar antes de ter resposta)
  const surveyOpts = surveys.map((s) => ({ id: s.id, name: s.name }));

  const scheduledItems: ScheduledItem[] = scheduled.map((s) => ({
    id: s.id,
    name: s.name,
    recipients: (s.recipients as string[]) ?? [],
    frequency: s.frequency,
    period: s.period,
    format: s.format,
    surveyIds: (s.surveyIds as string[]) ?? [],
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
        <DataFilters />
      </div>

      {/* Export manual */}
      <div className="mb-4">
        <ExportPanel surveys={exportOpts} totalResponses={stats.total} period={period} from={from} to={to} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ScheduleReports surveys={surveyOpts} initial={scheduledItems} />
        <PublicLinks surveys={surveyOpts} initial={linkItems} />
      </div>
    </div>
  );
}
