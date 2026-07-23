import { Download } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { MetricCard } from "@/components/ui/MetricCard";
import { ResponsesView, type ResponseItem } from "@/components/responses/ResponsesView";
import { listResponses, getStats, getScoreDistribution } from "@/lib/db/responses";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ResponsesPage() {
  const [rows, stats, distribution] = await Promise.all([
    listResponses(),
    getStats(),
    getScoreDistribution(),
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
      <PageHeader
        eyebrow="Respostas"
        title="Respostas"
        description="A voz dos seus clientes, agregada de todas as pesquisas — com sentimento e temas."
        actions={
          <Button variant="ghost" size="sm">
            <Download className="size-4" /> Exportar
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Total de respostas" value={stats.total} accent="roxo" />
        <MetricCard label="Sentimento positivo" value={`${stats.positivePct}%`} accent="verde" />
        <MetricCard label="Nota média" value={stats.avgScore ?? "—"} accent="azul" />
        <MetricCard label="Com comentário" value={items.filter((i) => i.comment).length} accent="laranja" />
      </div>

      <ResponsesView responses={items} distribution={distribution} total={stats.total} />
    </div>
  );
}
