import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { ResponsesView, type ResponseItem } from "@/components/responses/ResponsesView";
import { ExportMenu } from "@/components/responses/ExportMenu";
import { listResponses, getStats, getScoreDistribution, getWordCloud } from "@/lib/db/responses";
import { getCurrentProjectId } from "@/lib/auth/current";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ResponsesPage() {
  const projectId = await getCurrentProjectId();
  const [rows, stats, distribution, wordCloud] = await Promise.all([
    listResponses({ projectId }),
    getStats({ projectId }),
    getScoreDistribution({ projectId }),
    getWordCloud({ projectId }),
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
        actions={<ExportMenu />}
      />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Total de respostas" value={stats.total} accent="roxo" />
        <MetricCard label="Sentimento positivo" value={`${stats.positivePct}%`} accent="verde" />
        <MetricCard label="Nota média" value={stats.avgScore ?? "—"} accent="azul" />
        <MetricCard label="Com comentário" value={items.filter((i) => i.comment).length} accent="laranja" />
      </div>

      <ResponsesView responses={items} distribution={distribution} total={stats.total} wordCloud={wordCloud} />
    </div>
  );
}
