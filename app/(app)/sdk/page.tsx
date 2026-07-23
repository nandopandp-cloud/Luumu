import { Eye, EyeOff, Key, Zap, MonitorSmartphone, ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardTitle, CardSubtitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { InstallSnippets } from "@/components/sdk/InstallSnippets";

const SDK_KEY = "pk_live_8f21a9c4b7";

const trackSnippet = `// Evento customizado (para disparo por comportamento)
Luumu.track?.("plano_atualizado", { de: "free", para: "growth" });`;

const autoEvents = [
  "pageview", "session", "click", "scroll", "rage click", "dead click",
  "form submit", "navigation", "conversion", "purchase", "signup", "login", "logout",
];

const keys = [
  { label: "SDK Key (pública)", value: SDK_KEY, masked: false },
  { label: "API Key (secreta)", value: "sk_live_••••••••••3f9d", masked: true },
];

export default function SdkPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Configuração"
        title="SDK & Instalação"
        description="Cole um script no seu produto. As pesquisas ativas aparecem dentro dele — sem redirecionar o usuário."
        actions={
          <Button href="/demo" size="sm" variant="ghost">
            <MonitorSmartphone className="size-4" /> Ver demonstração <ArrowUpRight className="size-3.5" />
          </Button>
        }
      />

      {/* Como funciona */}
      <Card className="mb-4 [background:var(--grad-roxo)] text-white">
        <div className="flex flex-col gap-2">
          <CardTitle className="text-white">Pesquisas embutidas no seu produto</CardTitle>
          <p className="max-w-3xl text-sm text-white/85">
            Diferente de um link externo, o Luumu injeta a pesquisa <strong>dentro</strong> da sua aplicação via
            um widget isolado (Shadow DOM). O usuário responde sem sair do fluxo — como Hotjar, PostHog e
            Intercom. Você controla formato, posição e disparo na aba <strong>Exibição</strong> de cada pesquisa.
          </p>
        </div>
      </Card>

      <InstallSnippets sdkKey={SDK_KEY} />

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <div className="mb-1 flex items-center gap-2">
            <Zap className="size-4 text-accent" />
            <CardTitle>Eventos capturados automaticamente</CardTitle>
          </div>
          <CardSubtitle>Base para disparar pesquisas por comportamento (fase seguinte).</CardSubtitle>
          <div className="mt-4 flex flex-wrap gap-2">
            {autoEvents.map((e) => (
              <span key={e} className="rounded-full bg-surface-brand px-3 py-1 font-mono text-xs font-semibold text-accent">
                {e}
              </span>
            ))}
          </div>
          <div className="mt-5">
            <CardSubtitle>Rastreamento manual</CardSubtitle>
            <CodeBlock code={trackSnippet} lang="js" className="mt-2" />
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Key className="size-4 text-accent" />
            <CardTitle>Chaves do projeto</CardTitle>
          </div>
          <div className="flex flex-col gap-3">
            {keys.map((k) => (
              <div key={k.label}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-semibold text-fg-soft">{k.label}</span>
                  {k.masked ? <Badge tone="warn" dot={false}>secreta</Badge> : <Badge tone="success" dot={false}>pública</Badge>}
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-line bg-bg-sunken px-3 py-2">
                  <span className="flex-1 truncate font-mono text-xs text-fg-soft">{k.value}</span>
                  {k.masked ? <EyeOff className="size-3.5 text-fg-mut" /> : <Eye className="size-3.5 text-fg-mut" />}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-bg-sunken p-3 text-xs text-fg-mut">
            <div className="mb-1 font-semibold text-fg-soft">Status do SDK</div>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-sucesso" /> Pronto para receber
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}
