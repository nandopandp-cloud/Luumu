import { Route } from "lucide-react";
import { hostList } from "@/lib/hosts";
import { savedPlatform } from "@/lib/platform";
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
  const [all, hosts, saved] = await Promise.all([listTours(projectId), listHosts(projectId), savedPlatform(projectId)]);
  // plataforma escolhida no header: os tours dela e os que valem para todas
  const picked = hostList(saved).filter((h) => hosts.includes(h));
  const rows = picked.length ? all.filter((t) => !t.targetHosts.length || t.targetHosts.some((h) => picked.includes(h))) : all;
  // novo tour começa na plataforma escolhida (com várias, na primeira)
  const platform = picked[0] ?? "";

  return (
    <div>
      <PageHeader
        eyebrow="Product Tours"
        title="Tours guiados"
        description="Mostre aos seus usuários exatamente o que eles precisam saber, no momento certo, dentro do seu produto. Sem código."
        actions={<NewTourButton hosts={hosts} defaultHost={platform} />}
      />
      <ToursTable
        hosts={hosts}
        items={rows.map((t) => ({ ...t, updatedAtLabel: timeAgo(t.updatedAt), updatedAt: undefined }))}
        newTour={<NewTourButton hosts={hosts} defaultHost={platform} label="Criar primeiro tour" icon={<Route className="size-4" />} />}
      />
    </div>
  );
}
