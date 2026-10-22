import { PageHeader } from "@/components/ui/PageHeader";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { InviteMemberButton } from "@/components/settings/InviteMemberButton";
import { MembersTable } from "@/components/settings/MembersTable";
import { requireUser, canManageWorkspace, getCurrentRole } from "@/lib/auth/current";
import { listWorkspaceMembersWithScope } from "@/lib/db/users";
import { listProjects } from "@/lib/db/projects";

export const dynamic = "force-dynamic";


export default async function MembersPage() {
  const { workspaceId, userId } = await requireUser();
  const [members, canManage, role, allProjects] = await Promise.all([
    listWorkspaceMembersWithScope(workspaceId),
    canManageWorkspace(),
    getCurrentRole(),
    // a lista completa do workspace (não a com escopo): é o universo de opções que o
    // owner atribui aos membros, e só o owner enxerga esta tela de escopo
    listProjects(workspaceId),
  ]);
  const isOwner = role === "owner";

  return (
    <div>
      <PageHeader
        eyebrow="Configuração"
        title="Membros & Permissões"
        description="Convide seu time, controle o acesso por papel e defina quais projetos cada pessoa enxerga."
        actions={
          <InviteMemberButton
            canManage={canManage}
            isOwner={isOwner}
            projects={allProjects.map((p) => ({ id: p.id, name: p.name }))}
          />
        }
      />
      <SettingsNav />

      <MembersTable
        members={members}
        currentUserId={userId}
        canManage={canManage}
        isOwner={isOwner}
        projects={allProjects.map((p) => ({ id: p.id, name: p.name }))}
      />
    </div>
  );
}
