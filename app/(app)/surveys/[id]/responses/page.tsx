import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ResponsesView, type ResponseItem } from "@/components/responses/ResponsesView";
import { SurveySubnav } from "@/components/survey/SurveySubnav";
import { getSurvey } from "@/lib/db/surveys";
import { listResponses, getStats, getScoreDistribution } from "@/lib/db/responses";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SurveyResponsesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const survey = await getSurvey(id);
  if (!survey) notFound();

  const [rows, stats, distribution] = await Promise.all([
    listResponses(id),
    getStats(id),
    getScoreDistribution(id),
  ]);

  const items: ResponseItem[] = rows.map((r) => ({
    id: r.id,
    user: r.respondent ?? "Anônimo",
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
      <div className="mb-6">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">{survey.name}</h1>
        <p className="mt-1 text-sm text-fg-mut">
          {stats.total} respostas · nota média {stats.avgScore ?? "—"}
        </p>
      </div>

      <SurveySubnav id={id} />

      <ResponsesView responses={items} distribution={distribution} total={stats.total} />
    </div>
  );
}
