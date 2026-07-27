import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ResponsesView, type ResponseItem } from "@/components/responses/ResponsesView";
import { ExportMenu } from "@/components/responses/ExportMenu";
import { SurveySubnav } from "@/components/survey/SurveySubnav";
import { getSurvey } from "@/lib/db/surveys";
import { listResponses, getStats, getScoreDistribution, getWordCloud, getMainScore } from "@/lib/db/responses";
import { getCurrentWorkspaceId } from "@/lib/auth/current";
import { timeAgo } from "@/lib/utils";
import { formatScore } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export default async function SurveyResponsesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workspaceId = await getCurrentWorkspaceId();
  const survey = await getSurvey(id, { workspaceId });
  if (!survey) notFound();

  const scope = { projectId: survey.projectId, surveyId: id };
  const [rows, stats, distribution, wordCloud, mainScore] = await Promise.all([
    listResponses(scope),
    getStats(scope),
    getScoreDistribution(scope),
    getWordCloud(scope),
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
      <Link
        href="/surveys"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-fg-mut hover:text-accent"
      >
        <ArrowLeft className="size-4" /> Pesquisas
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">{survey.name}</h1>
          <p className="mt-1 text-sm text-fg-mut">
            {stats.total} respostas
            {mainScore && (
              <>
                {" "}
                · {mainScore.label} {formatScore(mainScore)}
              </>
            )}
          </p>
        </div>
        <ExportMenu surveyId={id} />
      </div>

      <SurveySubnav id={id} />

      <ResponsesView responses={items} distribution={distribution} total={stats.total} wordCloud={wordCloud} />
    </div>
  );
}
