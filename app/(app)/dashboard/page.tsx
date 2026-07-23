import Link from "next/link";
import { Plus, Smile, TrendingUp, Users, Inbox } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { Card, CardHeader, CardTitle, CardSubtitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Mascot } from "@/components/ui/Mascot";
import { AreaTrend, DonutChart } from "@/components/charts/Charts";
import { csatTrend, channelSplit } from "@/lib/mock/dashboard";
import { listSurveys } from "@/lib/db/surveys";
import { getStats } from "@/lib/db/responses";

export const dynamic = "force-dynamic";

const statusTone = {
  ativa: "success",
  pausada: "warn",
  encerrada: "neutral",
  rascunho: "brand",
} as const;

export default async function DashboardPage() {
  const [allSurveys, stats] = await Promise.all([listSurveys(), getStats()]);
  const activeCount = allSurveys.filter((s) => s.status === "ativa").length;
  const recent = allSurveys.slice(0, 5);

  return (
    <div>
      <PageHeader
        eyebrow="Visão geral"
        title="Olá, Fernando 👋"
        description="Acompanhe o que está acontecendo com suas pesquisas e a voz dos seus clientes."
        actions={
          <>
            <Button variant="ghost" size="sm">
              Últimos 30 dias
            </Button>
            <Button href="/surveys/new" size="sm">
              <Plus className="size-4" /> Nova pesquisa
            </Button>
          </>
        }
      />

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Nota média" value={stats.avgScore ?? "—"} accent="roxo" icon={<Smile className="size-5" />} />
        <MetricCard label="Sentimento positivo" value={`${stats.positivePct}%`} accent="verde" icon={<TrendingUp className="size-5" />} />
        <MetricCard label="Respostas" value={stats.total} accent="azul" icon={<Inbox className="size-5" />} />
        <MetricCard label="Pesquisas ativas" value={activeCount} accent="laranja" icon={<Users className="size-5" />} />
      </div>

      {/* Gráficos */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Evolução do CSAT</CardTitle>
              <CardSubtitle>Média semanal · últimos 2 meses</CardSubtitle>
            </div>
            <Badge tone="success">↑ 8%</Badge>
          </CardHeader>
          <AreaTrend data={csatTrend} dataKey="csat" />
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Respostas por canal</CardTitle>
              <CardSubtitle>Distribuição no período</CardSubtitle>
            </div>
          </CardHeader>
          <DonutChart data={channelSplit} />
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
            {channelSplit.map((c) => (
              <div key={c.name} className="flex items-center gap-1.5 text-xs text-fg-mut">
                <span className="size-2 rounded-full" style={{ background: c.color }} />
                {c.name} <span className="font-semibold text-fg">{c.value}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Pesquisas recentes + dica */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" padded={false}>
          <div className="flex items-center justify-between p-6 pb-3">
            <CardTitle>Pesquisas recentes</CardTitle>
            <Button href="/surveys" variant="ghost" size="sm">
              Ver todas
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-line text-left font-mono text-[11px] uppercase tracking-wide text-fg-mut">
                  <th className="px-6 py-2.5 font-semibold">Pesquisa</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 font-semibold">Respostas</th>
                  <th className="px-3 py-2.5 font-semibold">Tipo</th>
                  <th className="px-6 py-2.5 text-right font-semibold">Score</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((s) => (
                  <tr key={s.id} className="border-b border-line last:border-0 hover:bg-bg-sunken/50">
                    <td className="px-6 py-3 font-semibold">
                      <Link href={`/surveys/${s.id}/builder`} className="hover:text-accent">{s.name}</Link>
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={statusTone[s.status as keyof typeof statusTone]}>{s.status}</Badge>
                    </td>
                    <td className="px-3 py-3 text-fg-soft">{s.responseCount}</td>
                    <td className="px-3 py-3 text-fg-soft">{s.type}</td>
                    <td className="px-6 py-3 text-right font-bold text-luumu-roxo">{s.score ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="relative overflow-hidden [background:var(--grad-roxo)] text-white">
          <div className="relative z-10">
            <span className="font-mono text-xs font-semibold uppercase tracking-widest text-white/80">
              Dica Luumu
            </span>
            <h3 className="mt-2 font-display text-xl font-bold text-white">
              Explore nossos templates
            </h3>
            <p className="mt-1.5 text-sm text-white/85">
              Pesquisas prontas de CSAT, NPS e CES para você criar mais rápido.
            </p>
            <Button href="/surveys/new" variant="green" size="sm" className="mt-4">
              Ver templates
            </Button>
          </div>
          <Mascot name="Comemorando" size={130} className="absolute -bottom-3 -right-3 z-0 opacity-90" />
        </Card>
      </div>
    </div>
  );
}
