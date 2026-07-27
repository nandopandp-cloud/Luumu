import { Card, CardHeader, CardTitle, CardSubtitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { WordCloudItem } from "@/lib/wordcloud";

const sentimentTone = {
  positivo: "success",
  neutro: "warn",
  negativo: "error",
} as const;

export interface ResponseItem {
  id: string;
  user: string;
  channel: string;
  when: string;
  sentiment: "positivo" | "neutro" | "negativo" | null;
  score: number | null;
  comment: string;
}

export interface DistributionBucket {
  label: string;
  value: number; // %
  tone: string;
}

export function ResponsesView({
  responses,
  distribution,
  total,
  wordCloud,
}: {
  responses: ResponseItem[];
  distribution: DistributionBucket[];
  total: number;
  wordCloud: WordCloudItem[];
}) {
  if (responses.length === 0) {
    return (
      <EmptyState
        mascot="Pensativo"
        title="Ainda sem respostas"
        description="Publique uma pesquisa e compartilhe o link. As respostas aparecerão aqui em tempo real."
      />
    );
  }

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
                  <div className="text-xs text-fg-mut">{r.channel} · {r.when}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {r.sentiment && <Badge tone={sentimentTone[r.sentiment]}>{r.sentiment}</Badge>}
                {r.score != null && (
                  <span className="flex flex-col items-center">
                    <span className="grid size-9 place-items-center rounded-lg bg-surface-brand text-sm font-bold text-accent">
                      {r.score}
                    </span>
                    <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-fg-mut">Nota</span>
                  </span>
                )}
              </div>
            </div>
            {r.comment && <p className="mt-3 text-sm text-fg-soft">“{r.comment}”</p>}
          </Card>
        ))}
      </div>

      {/* Painel lateral */}
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Distribuição de notas</CardTitle>
              <CardSubtitle>Base: {total} respostas</CardSubtitle>
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
              <CardTitle>Palavras mais citadas</CardTitle>
              <CardSubtitle>Extraídas dos comentários reais das respostas</CardSubtitle>
            </div>
          </CardHeader>
          {wordCloud.length === 0 ? (
            <p className="text-sm text-fg-mut">
              Nenhum comentário com texto ainda. As palavras mais citadas aparecem aqui conforme as
              respostas chegam.
            </p>
          ) : (
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1.5">
              {wordCloud.map((w) => {
                // tamanho e cor proporcionais ao peso (0-1): mais citada = maior e mais destacada
                const fontSize = 12 + w.weight * 16; // 12px a 28px
                const opacity = 0.55 + w.weight * 0.45; // 0.55 a 1.0
                return (
                  <span
                    key={w.text}
                    title={`${w.count}×`}
                    className="font-bold leading-none text-accent"
                    style={{ fontSize, opacity }}
                  >
                    {w.text}
                  </span>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
