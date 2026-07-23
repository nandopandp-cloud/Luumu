import { Check, CreditCard } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardTitle, CardSubtitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { SoonBanner } from "@/components/ui/SoonBanner";
import { getCurrentWorkspaceId } from "@/lib/auth/current";
import { getWorkspaceUsage } from "@/lib/db/workspace";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const plans = [
  { key: "starter", name: "Starter", price: "R$ 0", per: "/mês", features: ["1.000 respostas/mês", "2 pesquisas ativas", "Dashboards básicos"] },
  { key: "growth", name: "Growth", price: "R$ 249", per: "/mês", features: ["50.000 respostas/mês", "Pesquisas ilimitadas", "Heatmaps + Replay", "Insights de IA"] },
  { key: "enterprise", name: "Enterprise", price: "Sob consulta", per: "", features: ["Volume ilimitado", "SSO + SAML", "SLA dedicado", "Success manager"] },
];

const fmt = (n: number) => (n === Infinity ? "∞" : n.toLocaleString("pt-BR"));
const pct = (used: number, limit: number) => (limit === Infinity ? 0 : Math.min(100, Math.round((used / limit) * 100)));

function UsageRow({ label, used, limit }: { label: string; used: number; limit: number }) {
  const p = pct(used, limit);
  const near = p >= 80;
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-sm">
        <span className="text-fg-soft">{label}</span>
        <span className={cn("font-semibold", near && "text-aviso")}>
          {fmt(used)} / {fmt(limit)}
        </span>
      </div>
      <Progress value={p} tone={near ? "brand" : "green"} />
    </div>
  );
}

export default async function BillingPage() {
  const workspaceId = await getCurrentWorkspaceId();
  const { plan, planLabel, usage, limits } = await getWorkspaceUsage(workspaceId);

  return (
    <div>
      <PageHeader eyebrow="Configuração" title="Plano & Cobrança" description="Gerencie sua assinatura, uso e forma de pagamento." />
      <SettingsNav />

      {/* Uso atual — REAL */}
      <Card className="mb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle>Plano {planLabel}</CardTitle>
              <Badge tone="success">ativo</Badge>
            </div>
            <CardSubtitle>Uso atual do seu workspace neste ciclo.</CardSubtitle>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <UsageRow label="Respostas" used={usage.responses} limit={limits.responses} />
          <UsageRow label="Pesquisas ativas" used={usage.activeSurveys} limit={limits.activeSurveys} />
          <UsageRow label="Membros" used={usage.members} limit={limits.members} />
        </div>
      </Card>

      {/* Planos oferecidos — plano atual destacado pelo dado real */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {plans.map((p) => {
          const current = p.key === plan;
          return (
            <Card key={p.key} className={cn("flex flex-col", current && "border-accent ring-2 ring-accent/15")}>
              <div className="flex items-center justify-between">
                <CardTitle>{p.name}</CardTitle>
                {current && <Badge tone="brand">atual</Badge>}
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
              <Button variant={current ? "ghost" : "primary"} size="sm" className="mt-5 w-full" disabled={!current}>
                {current ? "Plano atual" : p.name === "Enterprise" ? "Falar com vendas" : "Fazer upgrade"}
              </Button>
            </Card>
          );
        })}
      </div>

      {/* Pagamento — depende de gateway, ainda não implementado */}
      <div className="mt-4">
        <SoonBanner className="mb-3">
          Troca de plano e forma de pagamento serão habilitadas com a integração ao gateway de pagamento. O uso
          acima já reflete os dados reais do seu workspace.
        </SoonBanner>
        <Card className="opacity-70">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="size-4 text-accent" />
              <CardTitle>Forma de pagamento</CardTitle>
            </div>
            <Badge tone="warn" dot={false}>Em breve</Badge>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-line p-3.5">
            <div className="flex items-center gap-3">
              <span className="grid h-8 w-12 place-items-center rounded-md bg-bg-sunken font-mono text-[11px] font-bold">
                —
              </span>
              <span className="text-sm text-fg-mut">Nenhum método cadastrado</span>
            </div>
            <Button variant="ghost" size="sm" disabled>Adicionar</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
