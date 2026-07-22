import { Check, CreditCard } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardTitle, CardSubtitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { cn } from "@/lib/utils";

const plans = [
  { name: "Starter", price: "R$ 0", per: "/mês", features: ["1.000 respostas/mês", "2 pesquisas ativas", "Dashboards básicos"], current: false },
  { name: "Growth", price: "R$ 249", per: "/mês", features: ["50.000 respostas/mês", "Pesquisas ilimitadas", "Heatmaps + Replay", "Insights de IA"], current: true },
  { name: "Enterprise", price: "Sob consulta", per: "", features: ["Volume ilimitado", "SSO + SAML", "SLA dedicado", "Success manager"], current: false },
];

export default function BillingPage() {
  return (
    <div>
      <PageHeader eyebrow="Configuração" title="Plano & Cobrança" description="Gerencie sua assinatura, uso e forma de pagamento." />
      <SettingsNav />

      {/* Uso atual */}
      <Card className="mb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle>Plano Growth</CardTitle>
              <Badge tone="success">ativo</Badge>
            </div>
            <CardSubtitle>Próxima cobrança em 22/08/2026 · R$ 249,00</CardSubtitle>
          </div>
          <Button variant="ghost" size="sm">Gerenciar assinatura</Button>
        </div>
        <div className="mt-5">
          <div className="mb-1.5 flex justify-between text-sm">
            <span className="text-fg-soft">Respostas usadas</span>
            <span className="font-semibold">32.400 / 50.000</span>
          </div>
          <Progress value={65} />
        </div>
      </Card>

      {/* Planos */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {plans.map((p) => (
          <Card
            key={p.name}
            className={cn(
              "flex flex-col",
              p.current && "border-accent ring-2 ring-accent/15"
            )}
          >
            <div className="flex items-center justify-between">
              <CardTitle>{p.name}</CardTitle>
              {p.current && <Badge tone="brand">atual</Badge>}
            </div>
            <div className="mt-2 flex items-end gap-1">
              <span className="font-display text-3xl font-extrabold tracking-tight">{p.price}</span>
              <span className="mb-1 text-sm text-fg-mut">{p.per}</span>
            </div>
            <ul className="mt-4 flex flex-1 flex-col gap-2">
              {p.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-fg-soft">
                  <Check className="size-4 shrink-0 text-luumu-verde" /> {f}
                </li>
              ))}
            </ul>
            <Button
              variant={p.current ? "ghost" : "primary"}
              size="sm"
              className="mt-5 w-full"
            >
              {p.current ? "Plano atual" : p.name === "Enterprise" ? "Falar com vendas" : "Fazer upgrade"}
            </Button>
          </Card>
        ))}
      </div>

      {/* Forma de pagamento */}
      <Card className="mt-4">
        <div className="mb-3 flex items-center gap-2">
          <CreditCard className="size-4 text-accent" />
          <CardTitle>Forma de pagamento</CardTitle>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-line p-3.5">
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-12 place-items-center rounded-md bg-bg-sunken font-mono text-[11px] font-bold">
              VISA
            </span>
            <span className="text-sm">•••• •••• •••• 4242</span>
          </div>
          <Button variant="ghost" size="sm">Alterar</Button>
        </div>
      </Card>
    </div>
  );
}
