import { Shield } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { InviteMemberButton } from "@/components/settings/InviteMemberButton";
import { MembersTable } from "@/components/settings/MembersTable";
import { requireUser, canManageWorkspace } from "@/lib/auth/current";
import { listWorkspaceMembers } from "@/lib/db/users";

export const dynamic = "force-dynamic";

const roles = [
  { role: "Owner", desc: "Acesso total, incluindo billing e exclusão do workspace." },
  { role: "Admin", desc: "Gerencia membros, projetos e integrações." },
  { role: "Editor", desc: "Cria e edita pesquisas, vê todas as respostas." },
  { role: "Viewer", desc: "Apenas visualização de dashboards e respostas." },
];

export default async function MembersPage() {
  const { workspaceId, userId } = await requireUser();
  const [members, canManage] = await Promise.all([
    listWorkspaceMembers(workspaceId),
    canManageWorkspace(),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="Configuração"
        title="Membros & Permissões"
        description="Convide seu time e controle o acesso por papel."
        actions={<InviteMemberButton canManage={canManage} />}
      />
      <SettingsNav />

      <MembersTable members={members} currentUserId={userId} canManage={canManage} />

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
      </Card>
    </div>
  );
}
