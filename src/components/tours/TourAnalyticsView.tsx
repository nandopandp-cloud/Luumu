import { AlertTriangle, Flag, PlayCircle, CheckCircle2, Timer, Crosshair } from "lucide-react";
import { Card, CardHeader, CardTitle, CardSubtitle } from "@/components/ui/Card";
import { MetricCard } from "@/components/ui/MetricCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { AreaTrend } from "@/components/charts/Charts";
import type { TourAnalytics } from "@/lib/db/tour-events";

export interface FunnelStep {
  key: string;
  label: string;
  viewed: number;
  completed: number;
  abandonedHere: number;
  notFound: number;
  avgMs: number | null;
}

function duration(sec: number | null): string {
  if (sec == null) return "—";
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  return `${m}min ${sec % 60}s`;
}

export function TourAnalyticsView({ data, funnel, days }: { data: TourAnalytics; funnel: FunnelStep[]; days: number }) {
  if (data.started === 0 && data.notFound === 0) {
    return (
      <EmptyState
        mascot="Analisando"
        title="Ainda sem execuções"
        description={`Assim que o tour publicado for visto pelos usuários, as métricas dos últimos ${days} dias aparecem aqui. Previews não contam.`}
      />
    );
  }
  const worst = funnel.reduce<FunnelStep | null>((w, s) => (s.abandonedHere > (w?.abandonedHere ?? 0) ? s : w), null);
  const base = Math.max(1, data.started);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Iniciaram" value={data.started.toLocaleString("pt-BR")} accent="roxo" icon={<PlayCircle className="size-5" />} />
        <MetricCard label="Concluíram" value={data.completed.toLocaleString("pt-BR")} accent="verde" icon={<CheckCircle2 className="size-5" />} />
        <MetricCard
          label="Taxa de conclusão"
          value={`${data.completionRate.toLocaleString("pt-BR")}%`}
          accent="azul"
          hint={`Abandono de ${data.abandonRate.toLocaleString("pt-BR")}%`}
          icon={<Flag className="size-5" />}
        />
        <MetricCard label="Tempo médio até concluir" value={duration(data.avgCompletionSec)} accent="laranja" icon={<Timer className="size-5" />} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Tours iniciados por dia</CardTitle>
              <CardSubtitle>Últimos {days} dias · sessões distintas</CardSubtitle>
            </div>
          </CardHeader>
          <AreaTrend data={data.daily.map((d) => ({ ...d, date: d.date.slice(8, 10) + "/" + d.date.slice(5, 7) }))} dataKey="started" height={240} />
        </Card>
        <Card>
          <CardTitle>Saúde do tour</CardTitle>
          <ul className="mt-4 flex flex-col gap-3 text-sm">
            <li className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-aviso" />
              <span>
                <strong className="font-semibold">{worst ? worst.label : "Nenhuma etapa"}</strong>
                <span className="block text-xs text-fg-mut">
                  {worst ? `Etapa com maior abandono: ${worst.abandonedHere} sessões pararam aqui` : "Ninguém abandonou o tour no período"}
                </span>
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Crosshair className="mt-0.5 size-4 shrink-0 text-erro" />
              <span>
                <strong className="font-semibold">{data.notFound.toLocaleString("pt-BR")} elementos não encontrados</strong>
                <span className="block text-xs text-fg-mut">
                  {data.notFound ? "Algum alvo mudou na tela. Revise os passos marcados abaixo." : "Todos os alvos foram encontrados."}
                </span>
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Flag className="mt-0.5 size-4 shrink-0 text-fg-mut" />
              <span>
                <strong className="font-semibold">{data.dismissed.toLocaleString("pt-BR")} dispensaram</strong>
                <span className="block text-xs text-fg-mut">{data.errors} erros de execução registrados</span>
              </span>
            </li>
          </ul>
        </Card>
      </div>

      <Card padded={false}>
        <div className="px-6 pb-2 pt-5">
          <CardTitle>Funil por etapa</CardTitle>
          <CardSubtitle>Quantas sessões viram cada passo, em relação às que iniciaram</CardSubtitle>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left font-mono text-[11px] uppercase tracking-wide text-fg-mut">
                <th className="px-6 py-3 font-semibold">Etapa</th>
                <th className="w-[38%] px-3 py-3 font-semibold">Viram</th>
                <th className="px-3 py-3 font-semibold">Avançaram</th>
                <th className="px-3 py-3 font-semibold">Pararam aqui</th>
                <th className="px-3 py-3 font-semibold">Não encontrado</th>
                <th className="px-6 py-3 text-right font-semibold">Tempo médio</th>
              </tr>
            </thead>
            <tbody>
              {funnel.map((s, i) => {
                const pct = Math.round((s.viewed / base) * 100);
                return (
                  <tr key={s.key} className="border-b border-line last:border-0">
                    <td className="px-6 py-3">
                      <span className="mr-2 font-mono text-xs text-fg-mut">{String(i + 1).padStart(2, "0")}</span>
                      <span className="font-semibold">{s.label}</span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-sunken">
                          <div className="h-full rounded-full [background:var(--grad-roxo)]" style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                        <span className="w-20 text-right text-xs font-semibold text-fg-soft">
                          {s.viewed} · {pct}%
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-fg-soft">{s.completed}</td>
                    <td className={`px-3 py-3 ${worst?.key === s.key ? "font-bold text-aviso" : "text-fg-soft"}`}>{s.abandonedHere}</td>
                    <td className={`px-3 py-3 ${s.notFound ? "font-semibold text-erro" : "text-fg-mut"}`}>{s.notFound || "—"}</td>
                    <td className="px-6 py-3 text-right text-fg-soft">{s.avgMs != null ? duration(Math.round(s.avgMs / 1000)) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
