import { UserPlus, Shield } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { requireUser } from "@/lib/auth/current";
import { listWorkspaceMembers } from "@/lib/db/users";

export const dynamic = "force-dynamic";

// role do banco (minúsculo) → rótulo + tom do badge
const roleMeta: Record<string, { label: string; tone: "brand" | "info" | "success" | "neutral" }> = {
  owner: { label: "Owner", tone: "brand" },
  admin: { label: "Admin", tone: "info" },
  editor: { label: "Editor", tone: "success" },
  viewer: { label: "Viewer", tone: "neutral" },
};

const roles = [
  { role: "Owner", desc: "Acesso total, incluindo billing e exclusão do workspace." },
  { role: "Admin", desc: "Gerencia membros, projetos e integrações." },
  { role: "Editor", desc: "Cria e edita pesquisas, vê todas as respostas." },
  { role: "Viewer", desc: "Apenas visualização de dashboards e respostas." },
];

export default async function MembersPage() {
  const { workspaceId, userId } = await requireUser();
  const members = await listWorkspaceMembers(workspaceId);

  return (
    <div>
      <PageHeader
        eyebrow="Configuração"
        title="Membros & Permissões"
        description="Convide seu time e controle o acesso por papel."
        actions={
          <Button size="sm">
            <UserPlus className="size-4" /> Convidar membro
          </Button>
        }
      />
      <SettingsNav />

      <Card padded={false} className="mb-4">
        <div className="p-6 pb-3">
          <CardTitle>Membros ({members.length})</CardTitle>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-line text-left font-mono text-[11px] uppercase tracking-wide text-fg-mut">
              <th className="px-6 py-2.5 font-semibold">Membro</th>
              <th className="px-3 py-2.5 font-semibold">Papel</th>
              <th className="px-6 py-2.5 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const meta = roleMeta[m.role] ?? { label: m.role, tone: "neutral" as const };
              const isCurrent = m.id === userId;
              return (
                <tr key={m.id} className="border-b border-line last:border-0 hover:bg-bg-sunken/50">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 place-items-center rounded-full text-sm font-bold text-white [background:var(--grad-marca)]">
                        {m.name.charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <div className="font-semibold">
                          {m.name}
                          {isCurrent && <span className="ml-2 text-xs font-normal text-fg-mut">(você)</span>}
                        </div>
                        <div className="text-xs text-fg-mut">{m.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3.5">
                    <Badge tone={meta.tone} dot={false}>{meta.label}</Badge>
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <Button variant="ghost" size="sm" disabled={isCurrent}>Editar</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

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
