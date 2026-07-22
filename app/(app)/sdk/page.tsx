import { Eye, EyeOff, Key, Zap } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardTitle, CardSubtitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CodeBlock } from "@/components/ui/CodeBlock";

const scriptSnippet = `<script src="https://cdn.luumu.com/sdk.js"></script>
<script>
  Luumu.init({
    projectId: "prj_8f21a9c4",
  });
</script>`;

const npmSnippet = `npm install @luumu/sdk

import { Luumu } from "@luumu/sdk";

Luumu.init({ projectId: "prj_8f21a9c4" });`;

const trackSnippet = `// Evento customizado
luumu.track("plano_atualizado", {
  de: "free",
  para: "growth",
  valor: 249,
});`;

const autoEvents = [
  "pageview", "session", "click", "scroll", "rage click", "dead click",
  "form submit", "navigation", "conversion", "purchase", "signup",
  "login", "logout", "custom events",
];

const keys = [
  { label: "SDK Key (pública)", value: "pk_live_8f21a9c4b7", masked: false },
  { label: "API Key (secreta)", value: "sk_live_••••••••••3f9d", masked: true },
];

export default function SdkPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Configuração"
        title="SDK & Eventos"
        description="Instale o SDK da Luumu em minutos e comece a capturar comportamento automaticamente."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Instalação via script</CardTitle>
          <CardSubtitle>Cole antes do fechamento do &lt;/body&gt;.</CardSubtitle>
          <CodeBlock code={scriptSnippet} lang="html" className="mt-4" />
        </Card>
        <Card>
          <CardTitle>Instalação via npm</CardTitle>
          <CardSubtitle>Para apps React, Vue, Angular e Next.js.</CardSubtitle>
          <CodeBlock code={npmSnippet} lang="bash" className="mt-4" />
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        {/* Eventos automáticos */}
        <Card>
          <div className="mb-1 flex items-center gap-2">
            <Zap className="size-4 text-accent" />
            <CardTitle>Eventos capturados automaticamente</CardTitle>
          </div>
          <CardSubtitle>Sem configuração adicional. Use também o método manual abaixo.</CardSubtitle>
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

        {/* Chaves */}
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
                  {k.masked ? (
                    <Badge tone="warn" dot={false}>secreta</Badge>
                  ) : (
                    <Badge tone="success" dot={false}>pública</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-line bg-bg-sunken px-3 py-2">
                  <span className="flex-1 truncate font-mono text-xs text-fg-soft">{k.value}</span>
                  {k.masked ? <EyeOff className="size-3.5 text-fg-mut" /> : <Eye className="size-3.5 text-fg-mut" />}
                </div>
              </div>
            ))}
            <Button variant="ghost" size="sm" className="mt-1 w-full">
              Rotacionar chaves
            </Button>
          </div>
          <div className="mt-4 rounded-xl bg-bg-sunken p-3 text-xs text-fg-mut">
            <div className="mb-1 font-semibold text-fg-soft">Status do SDK</div>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-sucesso" /> Recebendo eventos · 14.204 hoje
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}
