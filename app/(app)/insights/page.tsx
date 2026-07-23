import { Sparkles, ThumbsUp, ThumbsDown, TrendingDown, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle, CardSubtitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Mascot } from "@/components/ui/Mascot";
import { SoonBanner } from "@/components/ui/SoonBanner";
import { cn } from "@/lib/utils";
import { sentiment, clusters, pains, praises, recommendations, churnRisk } from "@/lib/mock/insights";

const sentimentTone = {
  positivo: "success",
  neutro: "warn",
  negativo: "error",
} as const;

export default function InsightsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Inteligência"
        title="Insights IA"
        description="A Luumu analisa milhares de respostas e destila o que importa: sentimento, temas e ações."
        actions={
          <Button size="sm" disabled>
            <Sparkles className="size-4" /> Gerar novo resumo
          </Button>
        }
      />

      <SoonBanner className="mb-4">
        A análise por IA (sentimento, temas, riscos de churn) ainda não está ligada às suas respostas reais.
        O conteúdo abaixo é um exemplo do formato dos insights — não uma análise do seu workspace.
      </SoonBanner>

      {/* Resumo executivo com mascote */}
      <Card className="relative overflow-hidden opacity-70 [background:var(--grad-roxo)] text-white">
        <div className="relative z-10 max-w-3xl">
          <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-widest text-white/80">
            <Sparkles className="size-3.5" /> Resumo executivo · gerado por IA
          </span>
          <p className="mt-3 text-lg leading-relaxed text-white/95">
            No último período, o sentimento geral está <strong>72% positivo</strong>. Usuários
            elogiam a <strong>facilidade de uso</strong> e a <strong>qualidade dos insights</strong>,
            mas apontam atrito na <strong>exportação de dados</strong> e na{" "}
            <strong>performance dos heatmaps</strong>. Recomendamos priorizar a exportação para Excel —
            alto impacto, baixo esforço.
          </p>
        </div>
        <Mascot name="Analisando" size={150} className="absolute -bottom-4 -right-2 z-0 opacity-90" />
      </Card>

      {/* Sentimento + Clusters */}
      <div className="mt-4 grid grid-cols-1 gap-4 opacity-70 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Sentimento</CardTitle>
              <CardSubtitle>2.940 respostas analisadas</CardSubtitle>
            </div>
          </CardHeader>
          <div className="flex h-4 overflow-hidden rounded-full">
            <div className="bg-sucesso" style={{ width: `${sentiment.positivo}%` }} />
            <div className="bg-aviso" style={{ width: `${sentiment.neutro}%` }} />
            <div className="bg-erro" style={{ width: `${sentiment.negativo}%` }} />
          </div>
          <div className="mt-4 flex flex-col gap-2 text-sm">
            <Row color="bg-sucesso" label="Positivo" value={sentiment.positivo} />
            <Row color="bg-aviso" label="Neutro" value={sentiment.neutro} />
            <Row color="bg-erro" label="Negativo" value={sentiment.negativo} />
          </div>
        </Card>

        <Card className="lg:col-span-2" padded={false}>
          <div className="p-6 pb-3">
            <CardTitle>Clusters de temas</CardTitle>
            <CardSubtitle>Agrupados por similaridade semântica</CardSubtitle>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {clusters.map((c) => (
                <tr key={c.theme} className="border-t border-line hover:bg-bg-sunken/50">
                  <td className="px-6 py-3 font-semibold">{c.theme}</td>
                  <td className="px-3 py-3 text-fg-mut">{c.count} menções</td>
                  <td className="px-3 py-3">
                    <Badge tone={sentimentTone[c.sentiment as keyof typeof sentimentTone]}>
                      {c.sentiment}
                    </Badge>
                  </td>
                  <td className={cn("px-6 py-3 text-right font-mono font-semibold", c.trend.startsWith("-") ? "text-erro" : "text-sucesso")}>
                    {c.trend}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Dores & Elogios */}
      <div className="mt-4 grid grid-cols-1 gap-4 opacity-70 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-erro/12 text-erro">
              <ThumbsDown className="size-4" />
            </span>
            <CardTitle>Principais dores</CardTitle>
          </div>
          <ul className="flex flex-col gap-2.5">
            {pains.map((p) => (
              <li key={p} className="flex gap-2 text-sm text-fg-soft">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-erro" />
                {p}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-sucesso/12 text-sucesso">
              <ThumbsUp className="size-4" />
            </span>
            <CardTitle>Principais elogios</CardTitle>
          </div>
          <ul className="flex flex-col gap-2.5">
            {praises.map((p) => (
              <li key={p} className="flex gap-2 text-sm text-fg-soft">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-sucesso" />
                {p}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Recomendações + Churn */}
      <div className="mt-4 grid grid-cols-1 gap-4 opacity-70 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Recomendações priorizadas</CardTitle>
              <CardSubtitle>Impacto × esforço</CardSubtitle>
            </div>
          </CardHeader>
          <div className="flex flex-col gap-2.5">
            {recommendations.map((r) => (
              <div key={r.title} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
                <span className="text-sm font-medium">{r.title}</span>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Badge tone={r.impact === "Alto" ? "success" : "warn"} dot={false}>
                    {r.impact}
                  </Badge>
                  <Badge tone="neutral" dot={false}>{r.effort}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-erro/12 text-erro">
              <TrendingDown className="size-4" />
            </span>
            <CardTitle>Risco de churn detectado</CardTitle>
          </div>
          <div className="flex flex-col gap-2.5">
            {churnRisk.map((c) => (
              <div key={c.account} className="flex items-center gap-3 rounded-xl border border-line p-3">
                <div className="relative grid size-11 shrink-0 place-items-center">
                  <svg className="size-11 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="16" fill="none" className="stroke-bg-sunken" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="16" fill="none"
                      className="stroke-erro"
                      strokeWidth="3"
                      strokeDasharray={`${c.score} 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute text-[11px] font-bold">{c.score}</span>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{c.account}</div>
                  <div className="truncate text-xs text-fg-mut">{c.reason}</div>
                </div>
                <ArrowRight className="ml-auto size-4 shrink-0 text-fg-mut" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Row({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("size-2.5 rounded-full", color)} />
      <span className="text-fg-soft">{label}</span>
      <span className="ml-auto font-semibold">{value}%</span>
    </div>
  );
}
