import { PageHeader } from "@/components/ui/PageHeader";
import { ExportMenu } from "@/components/responses/ExportMenu";
import { ResponsesWorkspace } from "@/components/responses/feed/ResponsesWorkspace";
import { listSurveyOptions, resolveSurveyScope } from "@/lib/db/surveys";
import { listHosts } from "@/lib/db/hosts";
import { getCurrentProjectId } from "@/lib/auth/current";
import { normalizeHost } from "@/lib/hosts";
import { periodToRange } from "@/lib/period";

export const dynamic = "force-dynamic";

export default async function ResponsesPage({
  searchParams,
}: {
  searchParams: Promise<{
    surveyId?: string;
    period?: string;
    from?: string;
    to?: string;
    host?: string;
    view?: string;
    sort?: string;
    limit?: string;
  }>;
}) {
  const sp = await searchParams;
  const projectId = await getCurrentProjectId();
  const host = normalizeHost(sp.host) || undefined;
  const { from: dateFrom, to: dateTo } = periodToRange(sp.period ?? "all", sp.from, sp.to);
  // sem filtro na URL, abre em "Todas as pesquisas" e "Todo o período"
  const [{ surveyId, defaultSurveyId }, surveyOptions, hosts] = await Promise.all([
    resolveSurveyScope(projectId, sp.surveyId ?? "all", host),
    listSurveyOptions(projectId, host),
    listHosts(projectId),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="Respostas"
        title="Respostas recebidas"
        description="A voz dos seus clientes, com sentimento, temas e comentários em um só lugar."
        actions={<ExportMenu surveyId={surveyId} host={host} />}
      />
      <ResponsesWorkspace
        scope={{ projectId, surveyId, dateFrom, dateTo, host }}
        params={{ view: sp.view, sort: sp.sort, limit: sp.limit }}
        hosts={hosts}
        hostInFilters={false}
        surveyFilter={{ options: surveyOptions, defaultSurveyId }}
        hrefBase="/responses"
      />
    </div>
  );
}
