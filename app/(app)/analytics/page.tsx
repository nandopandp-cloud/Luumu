import { Info } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle, CardSubtitle } from "@/components/ui/Card";
import { MetricCard } from "@/components/ui/MetricCard";
import { Badge } from "@/components/ui/Badge";
import { AreaTrend } from "@/components/charts/Charts";
import { cn } from "@/lib/utils";
import { funnel, retention, cohorts, topPages } from "@/lib/mock/analytics";

// Selo aplicado a blocos que dependem da camada de analytics de comportamento (ainda não coletada).
function SoonBadge() {
  return <Badge tone="warn" dot={false}>Em breve</Badge>;
}

function cohortColor(v: number | null) {
  if (v === null) return "bg-transparent text-transparent";
  if (v >= 80) return "bg-luumu-roxo text-white";
  if (v >= 55) return "bg-luumu-roxo/70 text-white";
  if (v >= 40) return "bg-luumu-roxo/45 text-white";
  if (v >= 30) return "bg-luumu-roxo/25 text-fg";
  return "bg-luumu-roxo/12 text-fg-soft";
}

export default function AnalyticsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Inteligência"
        title="Analytics de comportamento"
        description="Funis, retenção, cohorts e engajamento — entenda o comportamento ao longo do tempo."
      />

      {/* Aviso: esta área depende de coleta de comportamento que ainda não existe */}
      <Card className="mb-4 border-aviso/40 bg-aviso/10">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 size-5 shrink-0 text-aviso" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-fg">Prévia — dados ilustrativos</span>
              <Badge tone="warn" dot={false}>Em breve</Badge>
            </div>
            <p className="mt-1 max-w-3xl text-sm text-fg-soft">
              Estas métricas (DAU/MAU, funil, retenção, cohorts) dependem de uma camada de{" "}
              <strong>analytics de comportamento</strong> que ainda não coletamos — o SDK hoje registra{" "}
              <em>eventos nomeados</em> e <em>respostas de pesquisa</em>. Os números abaixo são exemplos de layout,
              não dados do seu workspace. Enquanto isso, use o{" "}
              <a href="/dashboard" className="font-semibold text-accent hover:underline">Dashboard</a> e a{" "}
              <a href="/responses" className="font-semibold text-accent hover:underline">Respostas</a> para dados reais de feedback.
            </p>
          </div>
        </div>
      </Card>

      <div className="mb-4 grid grid-cols-2 gap-4 opacity-70 lg:grid-cols-4">
        <MetricCard label="DAU" value="—" accent="roxo" />
        <MetricCard label="WAU" value="—" accent="azul" />
        <MetricCard label="MAU" value="—" accent="verde" />
        <MetricCard label="Stickiness" value="—" accent="laranja" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Funil */}
        <Card className="opacity-70">
          <CardHeader>
            <div>
              <CardTitle>Funil de ativação</CardTitle>
              <CardSubtitle>Do primeiro acesso à ativação</CardSubtitle>
            </div>
            <SoonBadge />
          </CardHeader>
          <div className="flex flex-col gap-2.5">
            {funnel.map((f, i) => (
              <div key={f.step}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium">{f.step}</span>
                  <span className="text-fg-mut">
                    <span className="font-semibold text-fg">{f.value.toLocaleString("pt-BR")}</span> · {f.pct}%
                  </span>
                </div>
                <div className="h-7 overflow-hidden rounded-lg bg-bg-sunken">
                  <div
                    className="flex h-full items-center rounded-lg [background:var(--grad-roxo)]"
                    style={{ width: `${f.pct}%` }}
                  >
                    {i > 0 && (
                      <span className="ml-auto pr-2 font-mono text-[10px] font-semibold text-white/90">
                        {Math.round((f.value / funnel[i - 1].value) * 100)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Retenção */}
        <Card className="opacity-70">
          <CardHeader>
            <div>
              <CardTitle>Curva de retenção</CardTitle>
              <CardSubtitle>% de usuários que retornam</CardSubtitle>
            </div>
            <SoonBadge />
          </CardHeader>
          <AreaTrend data={retention} dataKey="value" xKey="day" color="var(--luumu-verde)" height={200} />
        </Card>
      </div>

      {/* Cohorts */}
      <Card className="mt-4 opacity-70">
        <CardHeader>
          <div>
            <CardTitle>Cohorts de retenção</CardTitle>
            <CardSubtitle>Retenção semanal por coorte de entrada</CardSubtitle>
          </div>
          <SoonBadge />
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-1 text-center text-sm">
            <thead>
              <tr className="font-mono text-[11px] uppercase text-fg-mut">
                <th className="px-2 py-1 text-left">Coorte</th>
                <th className="px-2 py-1 text-left">Tamanho</th>
                {["P0", "P1", "P2", "P3", "P4", "P5"].map((p) => (
                  <th key={p} className="px-2 py-1">{p}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cohorts.map((c) => (
                <tr key={c.cohort}>
                  <td className="py-1 text-left text-sm font-semibold">{c.cohort}</td>
                  <td className="py-1 text-left text-sm text-fg-mut">{c.size}</td>
                  {c.values.map((v, i) => (
                    <td key={i}>
                      <div className={cn("rounded-md py-2 text-xs font-semibold", cohortColor(v))}>
                        {v !== null ? `${v}%` : ""}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Top páginas */}
      <Card className="mt-4 opacity-70" padded={false}>
        <div className="flex items-center justify-between p-6 pb-3">
          <CardTitle>Top páginas</CardTitle>
          <SoonBadge />
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-line text-left font-mono text-[11px] uppercase tracking-wide text-fg-mut">
              <th className="px-6 py-2.5 font-semibold">Página</th>
              <th className="px-3 py-2.5 font-semibold">Visualizações</th>
              <th className="px-6 py-2.5 text-right font-semibold">Tempo médio</th>
            </tr>
          </thead>
          <tbody>
            {topPages.map((p) => (
              <tr key={p.page} className="border-b border-line last:border-0 hover:bg-bg-sunken/50">
                <td className="px-6 py-3 font-mono font-semibold text-accent">{p.page}</td>
                <td className="px-3 py-3 text-fg-soft">{p.views.toLocaleString("pt-BR")}</td>
                <td className="px-6 py-3 text-right text-fg-soft">{p.avg}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
