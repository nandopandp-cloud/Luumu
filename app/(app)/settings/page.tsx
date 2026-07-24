import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { WorkspaceForm } from "@/components/settings/WorkspaceForm";
import { requireUser, canManageWorkspace } from "@/lib/auth/current";
import { getWorkspace } from "@/lib/db/workspace";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { workspaceId } = await requireUser();
  const [ws, canManage] = await Promise.all([getWorkspace(workspaceId), canManageWorkspace()]);
  if (!ws) notFound();

  return (
    <div>
      <PageHeader eyebrow="Configuração" title="Configurações" description="Gerencie seu workspace, projetos e preferências." />
      <SettingsNav />

      <WorkspaceForm
        canManage={canManage}
        initial={{
          name: ws.name,
          slug: ws.slug,
          timezone: ws.timezone,
          logoUrl: ws.logoUrl,
        }}
      />
    </div>
  );
}
