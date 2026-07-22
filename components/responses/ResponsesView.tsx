import { Card, CardHeader, CardTitle, CardSubtitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { responses, distribution, topThemes } from "@/lib/mock/responses";

const sentimentTone = {
  positivo: "success",
  neutro: "warn",
  negativo: "error",
} as const;

export function ResponsesView() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Feed de respostas */}
      <div className="flex flex-col gap-3 lg:col-span-2">
        {responses.map((r) => (
          <Card key={r.id} className="transition hover:border-line-strong">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-full text-sm font-bold text-white [background:var(--grad-marca)]">
                  {r.user.charAt(0)}
                </span>
                <div>
                  <div className="text-sm font-semibold">{r.user}</div>
                  <div className="text-xs text-fg-mut">
                    {r.channel} · {r.when}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={sentimentTone[r.sentiment]}>{r.sentiment}</Badge>
                <span className="grid size-9 place-items-center rounded-lg bg-surface-brand text-sm font-bold text-accent">
                  {r.score}
                </span>
              </div>
            </div>
            <p className="mt-3 text-sm text-fg-soft">“{r.comment}”</p>
          </Card>
        ))}
      </div>

      {/* Painel lateral */}
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Distribuição de notas</CardTitle>
              <CardSubtitle>Base: 640 respostas</CardSubtitle>
            </div>
          </CardHeader>
          <div className="flex flex-col gap-2.5">
            {distribution.map((d) => (
              <div key={d.label} className="flex items-center gap-3 text-sm">
                <span className="w-9 shrink-0 font-mono text-xs text-fg-mut">{d.label}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-bg-sunken">
                  <div className="h-full rounded-full" style={{ width: `${d.value}%`, background: d.tone }} />
                </div>
                <span className="w-9 shrink-0 text-right text-xs font-semibold">{d.value}%</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Principais temas</CardTitle>
              <CardSubtitle>Extraídos por IA dos comentários</CardSubtitle>
            </div>
          </CardHeader>
          <div className="flex flex-wrap gap-2">
            {topThemes.map((t) => (
              <span key={t} className="rounded-full bg-surface-brand px-3 py-1 text-sm font-semibold text-accent">
                {t}
              </span>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
