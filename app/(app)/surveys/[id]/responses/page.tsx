import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { ResponsesView, type ResponseItem } from "@/components/responses/ResponsesView";
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
        href={`/surveys/${id}/builder`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-fg-mut hover:text-accent"
      >
        <ArrowLeft className="size-4" /> {survey.name}
      </Link>
      <PageHeader
        eyebrow="Respostas da pesquisa"
        title={survey.name}
        description={`${stats.total} respostas · nota média ${stats.avgScore ?? "—"}`}
      />
      <ResponsesView responses={items} distribution={distribution} total={stats.total} />
    </div>
  );
}
