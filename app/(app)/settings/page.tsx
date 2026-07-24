import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { WorkspaceForm } from "@/components/settings/WorkspaceForm";
import { ProjectsCard } from "@/components/settings/ProjectsCard";
import { requireUser, canManageWorkspace, getCurrentProject } from "@/lib/auth/current";
import { getWorkspace } from "@/lib/db/workspace";
import { listProjects } from "@/lib/db/projects";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { workspaceId } = await requireUser();
  const [ws, canManage, projectList, activeProject] = await Promise.all([
    getWorkspace(workspaceId),
    canManageWorkspace(),
    listProjects(workspaceId),
    getCurrentProject(),
  ]);
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
        aside={
          <ProjectsCard
            projects={projectList.map((p) => ({ id: p.id, name: p.name, surveyCount: p.surveyCount, logoUrl: p.logoUrl }))}
            activeProjectId={activeProject?.id ?? null}
            canManage={canManage}
          />
        }
      />
    </div>
  );
}
