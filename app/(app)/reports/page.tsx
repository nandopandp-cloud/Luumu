import { FileText, Table2, FileSpreadsheet, Code2, Calendar, Link2, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardTitle, CardSubtitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

const formats = [
  { icon: FileText, label: "PDF", desc: "Relatório visual pronto para apresentar" },
  { icon: Table2, label: "CSV", desc: "Dados brutos para planilhas" },
  { icon: FileSpreadsheet, label: "Excel", desc: "Formatado com abas e filtros" },
  { icon: Code2, label: "API", desc: "Consuma via endpoint REST" },
];

const scheduled = [
  { name: "Relatório semanal · CSAT", freq: "Toda segunda, 9h", to: "time-produto@empresa.com", on: true },
  { name: "NPS mensal · Diretoria", freq: "Dia 1, 8h", to: "diretoria@empresa.com", on: true },
  { name: "Insights de IA · Quinzenal", freq: "A cada 15 dias", to: "cx@empresa.com", on: false },
];

export default function ReportsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Inteligência"
        title="Relatórios"
        description="Exporte, agende e compartilhe seus dados no formato ideal para cada público."
        actions={
          <Button size="sm">
            <Plus className="size-4" /> Novo relatório
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {formats.map((f) => {
          const Icon = f.icon;
          return (
            <Card key={f.label} className="fx-flash cursor-pointer transition hover:-translate-y-1 hover:border-accent">
              <span className="grid size-11 place-items-center rounded-xl bg-surface-brand text-accent">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-3 font-bold">{f.label}</h3>
              <p className="mt-0.5 text-xs text-fg-mut">{f.desc}</p>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Agendamentos */}
        <Card padded={false}>
          <div className="flex items-center justify-between p-6 pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-accent" />
              <CardTitle>Envios agendados</CardTitle>
            </div>
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

        {/* Compartilhamento */}
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Link2 className="size-4 text-accent" />
            <CardTitle>Links públicos</CardTitle>
          </div>
          <CardSubtitle>Compartilhe dashboards com quem não tem acesso à Luumu.</CardSubtitle>
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-line bg-bg-sunken px-3 py-2.5">
              <span className="flex-1 truncate font-mono text-xs text-fg-soft">
                luumu.com/share/csat-q2-x8f21a
              </span>
              <Button variant="subtle" size="sm">Copiar</Button>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-line bg-bg-sunken px-3 py-2.5">
              <span className="flex-1 truncate font-mono text-xs text-fg-soft">
                luumu.com/share/nps-diretoria-b3
              </span>
              <Button variant="subtle" size="sm">Copiar</Button>
            </div>
            <Button variant="ghost" size="sm" className="mt-1 w-full">
              <Plus className="size-4" /> Gerar novo link
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
