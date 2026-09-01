"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { MoreHorizontal, Trash2, Loader2, AlertTriangle, FolderCog, UserCog } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import {
  removeMemberAction,
  setMemberProjectsAction,
  setMemberRoleAction,
} from "@/app/(app)/settings/actions";
import { ProjectScopePicker, type ProjectOption } from "./ProjectScopePicker";

export interface MemberRow {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  /** projetos que o membro enxerga; [] = todos (convenção do backend) */
  projectIds: string[];
}

const roleMeta: Record<string, { label: string; tone: "brand" | "info" | "success" | "neutral" }> = {
  owner: { label: "Owner", tone: "brand" },
  admin: { label: "Admin", tone: "info" },
  editor: { label: "Editor", tone: "success" },
  viewer: { label: "Viewer", tone: "neutral" },
};

export function MembersTable({
  members,
  currentUserId,
  canManage,
  isOwner,
  projects,
}: {
  members: MemberRow[];
  currentUserId: string;
  canManage: boolean;
  isOwner: boolean;
  projects: ProjectOption[];
}) {
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [removing, setRemoving] = useState<MemberRow | null>(null);
  const [scoping, setScoping] = useState<MemberRow | null>(null);
  const [editingRole, setEditingRole] = useState<MemberRow | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function doRemove() {
    if (!removing) return;
    const target = removing;
    startTransition(async () => {
      const res = await removeMemberAction(target.id);
      if (res.ok) {
        toast("success", "Membro removido.");
        setRemoving(null);
        router.refresh();
      } else {
        toast("error", res.error ?? "Não foi possível remover o membro.");
      }
    });
  }

  return (
    <>
      <Card padded={false} className="mb-4 overflow-visible">
        <div className="p-6 pb-3">
          <div className="font-display text-lg font-bold">Membros ({members.length})</div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-line text-left font-mono text-[11px] uppercase tracking-wide text-fg-mut">
              <th className="px-6 py-2.5 font-semibold">Membro</th>
              <th className="px-3 py-2.5 font-semibold">Papel</th>
              <th className="px-3 py-2.5 font-semibold">Projetos</th>
              <th className="px-6 py-2.5 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const meta = roleMeta[m.role] ?? { label: m.role, tone: "neutral" as const };
              const isCurrent = m.id === currentUserId;
              const removable = canManage && !isCurrent && m.role !== "owner";
              // escopo e papel são prerrogativa do owner e não se aplicam ao próprio owner
              const scopable = isOwner && m.role !== "owner";
              // o owner não altera o próprio papel (o workspace ficaria sem dono)
              const roleEditable = isOwner && !isCurrent && m.role !== "owner";
              const hasMenu = removable || scopable || roleEditable;
              return (
                <tr key={m.id} className="group border-b border-line last:border-0 hover:bg-bg-sunken/50">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      {m.avatarUrl ? (
                        <Image
                          src={m.avatarUrl}
                          alt=""
                          width={36}
                          height={36}
                          className="size-9 rounded-full object-cover"
                        />
                      ) : (
                        <span className="grid size-9 place-items-center rounded-full text-sm font-bold text-white [background:var(--grad-marca)]">
                          {m.name.charAt(0).toUpperCase()}
                        </span>
                      )}
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
                  <td className="px-3 py-3.5">
                    <ScopeCell member={m} projects={projects} />
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    {hasMenu ? (
                      <div className="relative inline-block text-left">
                        <button
                          onClick={() => setMenuFor(menuFor === m.id ? null : m.id)}
                          className="rounded-lg p-1.5 text-fg-mut opacity-0 transition hover:bg-bg-sunken group-hover:opacity-100 aria-expanded:opacity-100"
                          aria-label="Ações"
                          aria-expanded={menuFor === m.id}
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                        {menuFor === m.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                            <div className="absolute right-0 top-9 z-20 w-52 overflow-hidden rounded-xl border border-line bg-bg-elev py-1 text-left shadow-[var(--shadow-lg)]">
                              {roleEditable && (
                                <button
                                  onClick={() => { setMenuFor(null); setEditingRole(m); }}
                                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-medium text-fg-soft hover:bg-bg-sunken"
                                >
                                  <UserCog className="size-4" /> Alterar papel
                                </button>
                              )}
                              {scopable && (
                                <button
                                  onClick={() => { setMenuFor(null); setScoping(m); }}
                                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-medium text-fg-soft hover:bg-bg-sunken"
                                >
                                  <FolderCog className="size-4" /> Acesso a projetos
                                </button>
                              )}
                              {removable && (
                                <button
                                  onClick={() => { setMenuFor(null); setRemoving(m); }}
                                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-medium text-erro hover:bg-bg-sunken"
                                >
                                  <Trash2 className="size-4" /> Remover membro
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      // sem ações disponíveis: o owner é intocável, e quem não é owner
                      // não altera papel nem escopo de ninguém
                      <span className="text-sm text-fg-mut">
                        {m.role === "owner" ? "Owner" : isCurrent ? "Você" : "—"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {editingRole && (
        <RoleDialog member={editingRole} onClose={() => setEditingRole(null)} />
      )}

      {scoping && (
        <ScopeDialog
          member={scoping}
          projects={projects}
          onClose={() => setScoping(null)}
        />
      )}

      {removing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setRemoving(null)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-line bg-bg-elev p-6 shadow-[var(--shadow-lg)]">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-erro/12 text-erro">
                <AlertTriangle className="size-5" />
              </span>
              <div>
                <h3 className="font-display text-lg font-bold">Remover membro?</h3>
                <p className="mt-1 text-sm text-fg-soft">
                  <strong>{removing.name}</strong> ({removing.email}) perderá o acesso a este workspace
                  imediatamente. Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setRemoving(null)}>Cancelar</Button>
              <Button variant="danger" size="sm" onClick={doRemove}>
                <Trash2 className="size-4" /> Remover
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Resumo do escopo do membro na tabela. */
function ScopeCell({ member, projects }: { member: MemberRow; projects: ProjectOption[] }) {
  if (member.role === "owner") {
    return <span className="text-sm text-fg-mut">Todos</span>;
  }
  if (member.projectIds.length === 0) {
    return (
      <Badge tone="neutral" dot={false}>
        Todos os projetos
      </Badge>
    );
  }

  const names = member.projectIds
    .map((id) => projects.find((p) => p.id === id)?.name)
    .filter((n): n is string => Boolean(n));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {names.slice(0, 2).map((n) => (
        <Badge key={n} tone="brand" dot={false} className="max-w-36 truncate">
          {n}
        </Badge>
      ))}
      {names.length > 2 && (
        <span className="text-xs font-medium text-fg-mut">+{names.length - 2}</span>
      )}
    </div>
  );
}

/** Diálogo do owner para definir quais projetos um membro enxerga. */
function ScopeDialog({
  member,
  projects,
  onClose,
}: {
  member: MemberRow;
  projects: ProjectOption[];
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string[]>(member.projectIds);
  const [saving, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function save() {
    start(async () => {
      const res = await setMemberProjectsAction(member.id, { projectIds: selected });
      if (res.ok) {
        toast("success", "Acesso a projetos atualizado.");
        onClose();
        router.refresh();
      } else {
        toast("error", res.error ?? "Não foi possível salvar o acesso.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-bg-elev p-6 shadow-[var(--shadow-lg)]">
        <h3 className="font-display text-lg font-bold">Acesso a projetos</h3>
        <p className="mt-1 text-sm text-fg-mut">
          Escolha o que <strong>{member.name}</strong> enxerga neste workspace. Projetos fora
          da seleção somem do seletor, do menu e dos dados.
        </p>

        <div className="mt-4">
          <ProjectScopePicker
            projects={projects}
            selected={selected}
            onChange={setSelected}
            disabled={saving}
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null} Salvar acesso
          </Button>
        </div>
      </div>
    </div>
  );
}

/** O que cada papel permite — mostrado no diálogo para a escolha ser informada. */
const ROLE_OPTIONS: { value: "admin" | "editor" | "viewer"; label: string; desc: string }[] = [
  { value: "admin", label: "Admin", desc: "Gerencia membros, projetos e integrações." },
  { value: "editor", label: "Editor", desc: "Cria e edita pesquisas, vê todas as respostas." },
  { value: "viewer", label: "Viewer", desc: "Apenas visualização de dashboards e respostas." },
];

/** Diálogo do owner para trocar o papel de um membro. */
function RoleDialog({ member, onClose }: { member: MemberRow; onClose: () => void }) {
  const initial = ROLE_OPTIONS.find((r) => r.value === member.role)?.value ?? "viewer";
  const [role, setRole] = useState<"admin" | "editor" | "viewer">(initial);
  const [saving, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const current = ROLE_OPTIONS.find((r) => r.value === role);
  const changed = role !== member.role;

  function save() {
    start(async () => {
      const res = await setMemberRoleAction(member.id, { role });
      if (res.ok) {
        toast("success", `${member.name} agora é ${current?.label ?? role}.`);
        onClose();
        router.refresh();
      } else {
        toast("error", res.error ?? "Não foi possível alterar o papel.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-line bg-bg-elev p-6 shadow-[var(--shadow-lg)]">
        <h3 className="font-display text-lg font-bold">Alterar papel</h3>
        <p className="mt-1 text-sm text-fg-mut">
          Define o que <strong>{member.name}</strong> pode fazer no workspace. O acesso a
          projetos é configurado à parte.
        </p>

        <div className="mt-4">
          <Field label="Papel">
            <Select
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "editor" | "viewer")}
              disabled={saving}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </Select>
          </Field>
          {current && <p className="mt-2 text-sm text-fg-mut">{current.desc}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={save} disabled={saving || !changed}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null} Salvar papel
          </Button>
        </div>
      </div>
    </div>
  );
}
