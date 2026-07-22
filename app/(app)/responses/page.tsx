import { Download } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { MetricCard } from "@/components/ui/MetricCard";
import { ResponsesView } from "@/components/responses/ResponsesView";

export default function ResponsesPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Respostas"
        title="Respostas"
        description="A voz dos seus clientes, agregada de todas as pesquisas — com sentimento e temas."
        actions={
          <Button variant="ghost" size="sm">
            <Download className="size-4" /> Exportar
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Total de respostas" value="2.940" delta={12} accent="roxo" />
        <MetricCard label="Sentimento positivo" value="72%" delta={4} accent="verde" />
        <MetricCard label="Tempo médio" value="1m 48s" accent="azul" />
        <MetricCard label="Comentários" value="1.203" delta={9} accent="laranja" />
      </div>

      <ResponsesView />
    </div>
  );
}
