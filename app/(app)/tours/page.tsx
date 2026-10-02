import { Route } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { ToursTable } from "@/components/tours/ToursTable";
import { NewTourButton } from "@/components/tours/NewTourButton";
import { listTours } from "@/lib/db/tours";
import { listHosts } from "@/lib/db/hosts";
import { getCurrentProjectId } from "@/lib/auth/current";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ToursPage() {
  const projectId = await getCurrentProjectId();
  const [rows, hosts] = await Promise.all([listTours(projectId), listHosts(projectId)]);

  return (
    <div>
      <PageHeader
        eyebrow="Product Tours"
        title="Tours guiados"
        description="Mostre aos seus usuários exatamente o que eles precisam saber, no momento certo, dentro do seu produto. Sem código."
        actions={<NewTourButton hosts={hosts} />}
      />
      <ToursTable
        hosts={hosts}
        items={rows.map((t) => ({ ...t, updatedAtLabel: timeAgo(t.updatedAt), updatedAt: undefined }))}
        newTour={<NewTourButton hosts={hosts} label="Criar primeiro tour" icon={<Route className="size-4" />} />}
      />
    </div>
  );
}
