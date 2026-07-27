import { Card, CardHeader, CardTitle, CardSubtitle } from "@/components/ui/Card";
import { MetricCard } from "@/components/ui/MetricCard";
import type { ReportSnapshot } from "@/lib/db/report-snapshot";

/** Visualização read-only dos indicadores de um relatório (usada na página pública /r/[token]). */
export function PublicReportView({ snapshot }: { snapshot: ReportSnapshot }) {
  const s = snapshot;
  return (
    <div className="flex flex-col gap-4">
      {/* Métricas principais */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <MetricCard label="Respostas" value={s.total} accent="roxo" />
        <MetricCard label={s.scoreLabel} value={s.scoreValue} accent="azul" hint={s.scoreFormula ?? undefined} />
        <MetricCard label="Sentimento positivo" value={`${s.positivePct}%`} accent="verde" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Distribuição de notas */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Distribuição de notas</CardTitle>
              <CardSubtitle>Base: {s.total} respostas</CardSubtitle>
            </div>
          </CardHeader>
          {s.distribution.length === 0 ? (
            <p className="text-sm text-fg-mut">Sem notas para exibir.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {s.distribution.map((d) => (
                <div key={d.label} className="flex items-center gap-3 text-sm">
                  <span className="w-9 shrink-0 font-mono text-xs text-fg-mut">{d.label}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-bg-sunken">
                    <div className="h-full rounded-full" style={{ width: `${d.value}%`, background: d.tone }} />
                  </div>
                  <span className="w-9 shrink-0 text-right text-xs font-semibold">{d.value}%</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Nuvem de palavras */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Palavras mais citadas</CardTitle>
              <CardSubtitle>Extraídas dos comentários reais</CardSubtitle>
            </div>
          </CardHeader>
          {s.wordCloud.length === 0 ? (
            <p className="text-sm text-fg-mut">Nenhum comentário com texto ainda.</p>
          ) : (
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1.5">
              {s.wordCloud.map((w) => (
                <span
                  key={w.text}
                  title={`${w.count}×`}
                  className="font-bold leading-none text-accent"
                  style={{ fontSize: 12 + w.weight * 16, opacity: 0.55 + w.weight * 0.45 }}
                >
                  {w.text}
                </span>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
