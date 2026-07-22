import { Check } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { integrations } from "@/lib/mock/integrations";

export default function IntegrationsPage() {
  const connected = integrations.filter((i) => i.connected).length;

  return (
    <div>
      <PageHeader
        eyebrow="Configuração"
        title="Integrações"
        description="Conecte a Luumu às ferramentas do seu time e leve a voz do cliente para onde o trabalho acontece."
        actions={<Badge tone="success">{connected} conectadas</Badge>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {integrations.map((it) => (
          <Card key={it.name} className="flex flex-col">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span
                  className="grid size-11 place-items-center rounded-xl text-sm font-bold text-white"
                  style={{ background: it.color }}
                >
                  {it.initials}
                </span>
                <div>
                  <div className="font-bold">{it.name}</div>
                  <div className="text-xs text-fg-mut">{it.category}</div>
                </div>
              </div>
              {it.connected && (
                <span className="grid size-6 place-items-center rounded-full bg-sucesso/15 text-sucesso">
                  <Check className="size-3.5" />
                </span>
              )}
            </div>
            <p className="mt-3 flex-1 text-sm text-fg-mut">{it.desc}</p>
            <Button
              variant={it.connected ? "ghost" : "subtle"}
              size="sm"
              className="mt-4 w-full"
            >
              {it.connected ? "Gerenciar" : "Conectar"}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
