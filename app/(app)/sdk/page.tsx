import { Key, Zap, MonitorSmartphone, ArrowUpRight, MousePointerClick } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { InstallSnippets } from "@/components/sdk/InstallSnippets";
import { EventDetector } from "@/components/sdk/EventDetector";
import { getCurrentProjectId } from "@/lib/auth/current";
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
  const projectId = await getCurrentProjectId();
  const [sdkKey, events, activeSurveys] = await Promise.all([
    getPrimaryPublicKey(projectId),
    listEvents(projectId),
    listActiveSurveys(projectId),
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

  // gatilhos consolidados (array novo, com fallback pro campo legado)
  const triggersOf = (s: (typeof activeSurveys)[number]): string[] => {
    const list = ((s.triggerEvents as string[] | null) ?? []).slice();
    if (list.length === 0 && s.triggerEvent) list.push(s.triggerEvent);
    return list;
  };
  const withTrigger = activeSurveys.filter((s) => triggersOf(s).length > 0);
  const trackSnippet = `// Chame no momento exato em que a ação de negócio acontece —
// algo que um clique sozinho não descreve (ex: fluxo concluído,
// meta atingida, processamento terminado no backend).
Luumu.track("treino_concluido");`;

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

          <Step n={2} title="Eventos do seu produto">
            <p className="mb-3 max-w-2xl text-sm text-fg-mut">
              Assim que o script é instalado, o SDK já captura sozinho <strong>páginas visitadas</strong> e{" "}
              <strong>cliques em botões e links</strong> — sem escrever nenhuma linha de código. Cada um vira um{" "}
              <strong>gatilho disponível</strong> na criação da pesquisa.
            </p>

            <div className="mb-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-fg-soft">
                <MousePointerClick className="size-4 text-accent" /> Detecção ao vivo
              </div>
              <EventDetector initial={initialStatus} />
            </div>

            <p className="mb-3 max-w-2xl text-sm text-fg-mut">
              Para ações de <strong>negócio</strong> que não são um clique — completar um fluxo, atingir uma meta,
              um processo terminar no backend — chame{" "}
              <code className="font-mono text-[12.5px]">Luumu.track(&quot;nome_do_evento&quot;)</code> no momento
              exato em que isso acontece no seu produto.
            </p>
            <CodeBlock code={trackSnippet} lang="js" />
            <p className="mt-3 max-w-2xl text-xs text-fg-mut">
              Dica: para nomear um clique específico sem escrever JS, adicione{" "}
              <code className="font-mono text-[12px]">data-luumu-track=&quot;nome&quot;</code> no elemento HTML —
              ou <code className="font-mono text-[12px]">data-luumu-ignore</code> para excluí-lo do auto-tracking.
            </p>
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
                        <span className="flex flex-wrap justify-end gap-1">
                          {triggersOf(s).map((ev) => (
                            <Badge key={ev} tone="brand" dot={false}>{ev}</Badge>
                          ))}
                        </span>
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
                Páginas visitadas e cliques em botões/links são capturados <strong>automaticamente</strong>, sem
                código.
              </li>
              <li>
                Pesquisas <strong>sem</strong> gatilho aparecem no carregamento da página (respeitando a frequência).
              </li>
              <li>
                Pesquisas <strong>com</strong> gatilho por evento disparam quando aquele evento (automático ou via{" "}
                <code className="font-mono text-[12px]">Luumu.track()</code>) acontece.
              </li>
              <li>Cada usuário vê a mesma pesquisa uma vez (controlado por armazenamento local).</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
