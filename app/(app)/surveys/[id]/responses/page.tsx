import Link from "@/components/ui/Link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ExportMenu } from "@/components/responses/ExportMenu";
import { SurveySubnav } from "@/components/survey/SurveySubnav";
import { ResponsesWorkspace } from "@/components/responses/feed/ResponsesWorkspace";
import { getSurvey } from "@/lib/db/surveys";
import { listHosts } from "@/lib/db/hosts";
import { getCurrentProjectId } from "@/lib/auth/current";
import { normalizeHost } from "@/lib/hosts";
import { periodToRange } from "@/lib/period";

export const dynamic = "force-dynamic";

export default async function SurveyResponsesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string; from?: string; to?: string; host?: string; view?: string; sort?: string; limit?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  // escopo por projeto ativo (e não só por workspace): impede abrir por URL direta
  // uma pesquisa de projeto que o membro não tem permissão de ver
  const projectId = await getCurrentProjectId();
  const [survey, hosts] = await Promise.all([getSurvey(id, { projectId }), listHosts(projectId)]);
  if (!survey) notFound();
  const host = normalizeHost(sp.host) || undefined;
  const { from: dateFrom, to: dateTo } = periodToRange(sp.period ?? "all", sp.from, sp.to);

  return (
    <div>
      <Link href="/surveys" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-fg-mut hover:text-accent">
        <ArrowLeft className="size-4" /> Pesquisas
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">{survey.name}</h1>
          <p className="mt-1 text-sm text-fg-mut">Respostas desta pesquisa, com sentimento, temas e comentários.</p>
        </div>
        <ExportMenu surveyId={id} host={host} />
      </div>

      <SurveySubnav id={id} status={survey.status} />

      <ResponsesWorkspace
        scope={{ projectId: survey.projectId, surveyId: id, dateFrom, dateTo, host }}
        params={{ view: sp.view, sort: sp.sort, limit: sp.limit }}
        hosts={hosts}
        hrefBase={`/surveys/${id}/responses`}
      />
    </div>
  );
}
