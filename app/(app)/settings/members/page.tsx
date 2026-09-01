import { Shield } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { InviteMemberButton } from "@/components/settings/InviteMemberButton";
import { MembersTable } from "@/components/settings/MembersTable";
import { requireUser, canManageWorkspace, getCurrentRole } from "@/lib/auth/current";
import { listWorkspaceMembersWithScope } from "@/lib/db/users";
import { listProjects } from "@/lib/db/projects";

export const dynamic = "force-dynamic";

const roles = [
  { role: "Owner", desc: "Acesso total, incluindo billing e exclusão do workspace." },
  { role: "Admin", desc: "Gerencia membros, projetos e integrações." },
  { role: "Editor", desc: "Cria e edita pesquisas, vê todas as respostas." },
  { role: "Viewer", desc: "Apenas visualização de dashboards e respostas." },
];

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

      <Card>
        <div className="mb-3 flex items-center gap-2">
          <Shield className="size-4 text-accent" />
          <CardTitle>Papéis e permissões</CardTitle>
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {roles.map((r) => (
            <div key={r.role} className="rounded-xl border border-line p-3.5">
              <div className="font-semibold">{r.role}</div>
              <div className="mt-0.5 text-sm text-fg-mut">{r.desc}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-fg-mut">
          O papel define <strong>o que</strong> a pessoa pode fazer. O acesso a projetos define{" "}
          <strong>onde</strong> ela pode fazer — um Admin restrito ao projeto X administra
          apenas o projeto X e não enxerga os demais. Apenas o owner altera esse acesso.
        </p>
      </Card>
    </div>
  );
}
