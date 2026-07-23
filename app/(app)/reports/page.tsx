import { Calendar, Link2, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardTitle, CardSubtitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SoonBanner } from "@/components/ui/SoonBanner";
import { ExportPanel } from "@/components/reports/ExportPanel";
import { getCurrentWorkspaceId } from "@/lib/auth/current";
import { listSurveys } from "@/lib/db/surveys";
import { getStats } from "@/lib/db/responses";

export const dynamic = "force-dynamic";

const scheduled = [
  { name: "Relatório semanal · CSAT", freq: "Toda segunda, 9h", to: "time-produto@empresa.com", on: true },
  { name: "NPS mensal · Diretoria", freq: "Dia 1, 8h", to: "diretoria@empresa.com", on: true },
];

export default async function ReportsPage() {
  const workspaceId = await getCurrentWorkspaceId();
  const [surveys, stats] = await Promise.all([
    listSurveys(workspaceId),
    getStats({ workspaceId }),
  ]);

  const surveyOpts = surveys
    .filter((s) => s.responseCount > 0)
    .map((s) => ({ id: s.id, name: s.name, responseCount: s.responseCount }));

  return (
    <div>
      <PageHeader
        eyebrow="Inteligência"
        title="Relatórios"
        description="Exporte, agende e compartilhe seus dados no formato ideal para cada público."
      />

      {/* Export real */}
      <div className="mb-4">
        <ExportPanel surveys={surveyOpts} totalResponses={stats.total} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Agendamentos — ainda não implementado */}
        <div className="flex flex-col gap-3">
          <SoonBanner>
            Envio automático de relatórios por e-mail em uma agenda ainda não está disponível. Por enquanto,
            exporte manualmente acima.
          </SoonBanner>
          <Card padded={false} className="opacity-70">
            <div className="flex items-center justify-between p-6 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="size-4 text-accent" />
                <CardTitle>Envios agendados</CardTitle>
              </div>
              <Badge tone="warn" dot={false}>Em breve</Badge>
            </div>
            <div className="flex flex-col">
              {scheduled.map((s) => (
                <div key={s.name} className="flex items-center justify-between gap-3 border-t border-line px-6 py-3.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{s.name}</div>
                    <div className="truncate text-xs text-fg-mut">{s.freq} · {s.to}</div>
                  </div>
                  <Badge tone={s.on ? "success" : "neutral"}>{s.on ? "ativo" : "pausado"}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Links públicos — ainda não implementado */}
        <div className="flex flex-col gap-3">
          <SoonBanner>
            Links públicos de dashboards para quem não tem acesso à Luumu ainda estão em desenvolvimento.
          </SoonBanner>
          <Card className="opacity-70">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link2 className="size-4 text-accent" />
                <CardTitle>Links públicos</CardTitle>
              </div>
              <Badge tone="warn" dot={false}>Em breve</Badge>
            </div>
            <CardSubtitle>Compartilhe dashboards com quem não tem acesso à Luumu.</CardSubtitle>
            <Button variant="ghost" size="sm" className="mt-4 w-full" disabled>
              <Plus className="size-4" /> Gerar novo link
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
