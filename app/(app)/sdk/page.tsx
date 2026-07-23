import { Key, Zap, MonitorSmartphone, ArrowUpRight, MousePointerClick } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { InstallSnippets } from "@/components/sdk/InstallSnippets";
import { EventDetector } from "@/components/sdk/EventDetector";
import { getCurrentWorkspaceId } from "@/lib/auth/current";
import { getPrimaryPublicKey } from "@/lib/db/keys";
import { listEvents } from "@/lib/db/events";
import { listActiveSurveys } from "@/lib/db/surveys";

export const dynamic = "force-dynamic";

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-brand font-display text-sm font-bold text-accent">
          {n}
        </span>
        <span className="mt-1 w-px flex-1 bg-line" />
      </div>
      <div className="flex-1 pb-8">
        <h3 className="font-display text-lg font-bold tracking-tight">{title}</h3>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}

export default async function SdkPage() {
  const workspaceId = await getCurrentWorkspaceId();
  const [sdkKey, events, activeSurveys] = await Promise.all([
    getPrimaryPublicKey(workspaceId),
    listEvents(workspaceId),
    listActiveSurveys(workspaceId),
  ]);

  const initialStatus = {
    connected: events.length > 0,
    total: events.reduce((s, e) => s + e.count, 0),
    events: events.map((e) => ({
      name: e.name,
      count: e.count,
      lastSeenAt: e.lastSeenAt instanceof Date ? e.lastSeenAt.toISOString() : String(e.lastSeenAt),
    })),
  };

  const withTrigger = activeSurveys.filter((s) => s.triggerEvent);
  const firstEvent = events[0]?.name ?? "compra_concluida";
  const trackSnippet = `// Chame quando o evento acontecer no seu produto.
// O nome do evento vira um gatilho disponível para as pesquisas.
Luumu.track("${firstEvent}");`;

  return (
    <div>
      <PageHeader
        eyebrow="Configuração"
        title="Instalar o SDK"
        description="Três passos para começar a coletar feedback dentro do seu produto — sem redirecionar o usuário."
        actions={
          <Button href="/demo" size="sm" variant="ghost">
            <MonitorSmartphone className="size-4" /> Ver demonstração <ArrowUpRight className="size-3.5" />
          </Button>
        }
      />

      {!sdkKey && (
        <Card className="mb-4 border-aviso/40 bg-aviso/10">
          <p className="text-sm text-fg-soft">
            Nenhuma SDK key encontrada para este workspace. Crie uma chave para gerar o snippet de instalação.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* Coluna principal: os passos */}
        <div>
          <Step n={1} title="Cole o script no seu produto">
            <p className="mb-3 max-w-2xl text-sm text-fg-mut">
              Adicione antes do <code className="font-mono text-[12.5px]">&lt;/head&gt;</code>. As pesquisas ativas
              passam a aparecer dentro da sua aplicação via um widget isolado (Shadow DOM), sem conflitar com seu CSS.
            </p>
            {sdkKey && <InstallSnippets sdkKey={sdkKey} />}
          </Step>

          <Step n={2} title="Mapeie os eventos do seu produto">
            <p className="mb-3 max-w-2xl text-sm text-fg-mut">
              Chame <code className="font-mono text-[12.5px]">Luumu.track(&quot;nome_do_evento&quot;)</code> nos
              momentos que importam (compra, onboarding, cancelamento…). Cada nome enviado vira um{" "}
              <strong>gatilho disponível</strong> na criação da pesquisa.
            </p>
            <CodeBlock code={trackSnippet} lang="js" />

            <div className="mt-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-fg-soft">
                <MousePointerClick className="size-4 text-accent" /> Detecção ao vivo
              </div>
              <EventDetector initial={initialStatus} />
            </div>
          </Step>

          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-brand font-display text-sm font-bold text-accent">
                3
              </span>
            </div>
            <div className="flex-1">
              <h3 className="font-display text-lg font-bold tracking-tight">Ligue um evento a uma pesquisa</h3>
              <p className="mb-3 mt-3 max-w-2xl text-sm text-fg-mut">
                Na aba <strong>Configurações</strong> de cada pesquisa, escolha o <strong>Gatilho por evento</strong>.
                A pesquisa passa a disparar exatamente quando aquele evento acontecer no produto do seu cliente.
              </p>
              {withTrigger.length > 0 ? (
                <div className="rounded-xl border border-line bg-bg-sunken p-3">
                  <div className="mb-2 text-xs font-semibold text-fg-soft">Pesquisas já ligadas a um evento</div>
                  <ul className="flex flex-col gap-1.5">
                    {withTrigger.map((s) => (
                      <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate text-fg-soft">{s.name}</span>
                        <Badge tone="brand" dot={false}>{s.triggerEvent}</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="rounded-xl border border-line bg-bg-sunken p-3 text-sm text-fg-mut">
                  Nenhuma pesquisa ligada a um evento ainda.{" "}
                  <a href="/surveys" className="font-semibold text-accent hover:underline">
                    Configurar uma pesquisa →
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Coluna lateral: chave + como funciona */}
        <div className="flex flex-col gap-4">
          <Card>
            <div className="mb-3 flex items-center gap-2">
              <Key className="size-4 text-accent" />
              <CardTitle>Sua SDK key</CardTitle>
            </div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold text-fg-soft">Chave pública</span>
              <Badge tone="success" dot={false}>pública</Badge>
            </div>
            <div className="rounded-lg border border-line bg-bg-sunken px-3 py-2">
              <span className="font-mono text-xs text-fg-soft">{sdkKey ?? "—"}</span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-fg-mut">
              Pode ficar exposta no front-end do seu produto — ela só resolve para este workspace e respeita a
              lista de domínios permitidos.
            </p>
          </Card>

          <Card>
            <div className="mb-2 flex items-center gap-2">
              <Zap className="size-4 text-accent" />
              <CardTitle>Como o disparo funciona</CardTitle>
            </div>
            <ul className="mt-2 flex flex-col gap-2.5 text-sm text-fg-mut">
              <li>
                Pesquisas <strong>sem</strong> gatilho aparecem no carregamento da página (respeitando a frequência).
              </li>
              <li>
                Pesquisas <strong>com</strong> gatilho por evento só disparam quando você chama{" "}
                <code className="font-mono text-[12px]">Luumu.track()</code> com o nome correspondente.
              </li>
              <li>Cada usuário vê a mesma pesquisa uma vez (controlado por armazenamento local).</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
