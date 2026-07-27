import { Key, Zap, MonitorSmartphone, ArrowUpRight, MousePointerClick, Sparkles, Code2, UserCheck } from "lucide-react";
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
  const trackSnippet = `// Chame no momento exato em que a ação de negócio acontece,
// algo que um clique sozinho não descreve (ex: fluxo concluído,
// meta atingida, processamento terminado no backend).

async function generateVideo() {
  const result = await videoApi.create(/* ... */);
  Luumu.track("video_gerado"); // <- aqui
  return result;
}`;
  const identifySnippet = `// Chame uma vez, logo após o login (ou ao restaurar a sessão salva).
async function handleLoginSuccess(user) {
  await sessionApi.save(user);

  Luumu.identify({
    id: user.id,       // ID interno do seu usuário
    email: user.email,  // usado para segmentar pesquisas por e-mail
  });
}`;

  return (
    <div>
      <PageHeader
        eyebrow="Configuração"
        title="Instalar o SDK"
        description="Três passos para começar a coletar feedback dentro do seu produto, sem redirecionar o usuário."
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

          <Step n={2} title="O que é automático x o que precisa de código">
            <p className="mb-4 max-w-2xl text-sm text-fg-mut">
              O SDK funciona em duas camadas. Uma parte já funciona sozinha assim que o script é colado. A
              outra, identificar o usuário e marcar ações importantes do negócio, exige{" "}
              <strong>duas ou três linhas de código</strong> no produto do cliente. Veja exatamente onde entra
              cada uma.
            </p>

            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-sucesso/30 bg-sucesso/5 p-3.5">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-sucesso">
                  <Sparkles className="size-4" /> Automático, zero código
                </div>
                <ul className="flex flex-col gap-1.5 text-xs leading-relaxed text-fg-soft">
                  <li>• Páginas visitadas</li>
                  <li>• Cliques em botões e links</li>
                  <li>• Rage click (3 cliques rápidos no mesmo ponto = frustração)</li>
                  <li>• Intenção de saída (mouse indo em direção ao fechar/voltar)</li>
                  <li>• Saída da página</li>
                  <li>• Envio de qualquer formulário</li>
                  <li>• Tempo engajado na página (30s, 60s)</li>
                </ul>
              </div>
              <div className="rounded-xl border border-aviso/30 bg-aviso/5 p-3.5">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-aviso">
                  <Code2 className="size-4" /> Requer código do cliente
                </div>
                <ul className="flex flex-col gap-1.5 text-xs leading-relaxed text-fg-soft">
                  <li>
                    • <strong>Identificar o usuário</strong>, para segmentar por e-mail/ID (
                    <code className="font-mono text-[11.5px]">Luumu.identify()</code>)
                  </li>
                  <li>
                    • <strong>Ações de negócio</strong>, algo que não é um clique: fluxo concluído, meta
                    atingida, processo terminado no backend (
                    <code className="font-mono text-[11.5px]">Luumu.track()</code>)
                  </li>
                </ul>
              </div>
            </div>

            <div className="mb-5">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-fg-soft">
                <MousePointerClick className="size-4 text-accent" /> Detecção ao vivo
              </div>
              <EventDetector initial={initialStatus} />
            </div>

            {/* Bloco 1: identify, necessário para segmentação por usuário */}
            <div className="mb-5 rounded-xl border border-line bg-bg-sunken p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-fg">
                <UserCheck className="size-4 text-accent" /> 1. Identificar o usuário logado
              </div>
              <p className="mb-3 max-w-2xl text-sm text-fg-mut">
                Chame <strong>uma única vez</strong>, logo após o login (ou quando a sessão do usuário for
                carregada). Sem isso, pesquisas configuradas para &quot;Usuários específicos&quot; não
                encontram ninguém para exibir, o SDK não sabe quem está navegando.
              </p>
              <CodeBlock code={identifySnippet} lang="js" />
              <p className="mt-3 max-w-2xl text-xs text-fg-mut">
                Onde colar: dentro da função que trata o login com sucesso (ou no carregamento inicial, se a
                sessão já existir salva). Pode passar <code className="font-mono text-[12px]">id</code>,{" "}
                <code className="font-mono text-[12px]">email</code>, ou os dois. A identidade fica salva no
                navegador, não precisa chamar de novo a cada página.
              </p>
            </div>

            {/* Bloco 2: track, eventos de negócio */}
            <div className="rounded-xl border border-line bg-bg-sunken p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-fg">
                <Zap className="size-4 text-accent" /> 2. Marcar uma ação de negócio
              </div>
              <p className="mb-3 max-w-2xl text-sm text-fg-mut">
                Chame no exato momento em que a ação acontece no seu código, geralmente logo após uma chamada
                de API ter sucesso.
              </p>
              <CodeBlock code={trackSnippet} lang="js" />
              <p className="mt-3 max-w-2xl text-xs text-fg-mut">
                Dica: para nomear um clique específico sem escrever JS, adicione{" "}
                <code className="font-mono text-[12px]">data-luumu-track=&quot;nome&quot;</code> no elemento
                HTML, ou <code className="font-mono text-[12px]">data-luumu-ignore</code> para excluí-lo do
                auto-tracking.
              </p>
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
              Pode ficar exposta no front-end do seu produto, ela só resolve para este workspace e respeita a
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
              <li>
                Pesquisas para <strong>usuários específicos</strong> só aparecem depois de{" "}
                <code className="font-mono text-[12px]">Luumu.identify()</code> ter sido chamado com o
                e-mail/ID correspondente.
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
