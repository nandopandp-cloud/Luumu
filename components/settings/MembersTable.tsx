"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { removeMemberAction } from "@/app/(app)/settings/actions";

export interface MemberRow {
  id: string;
  name: string;
  email: string;
  role: string;
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
}: {
  members: MemberRow[];
  currentUserId: string;
  canManage: boolean;
}) {
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [removing, setRemoving] = useState<MemberRow | null>(null);
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
              <th className="px-6 py-2.5 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const meta = roleMeta[m.role] ?? { label: m.role, tone: "neutral" as const };
              const isCurrent = m.id === currentUserId;
              const removable = canManage && !isCurrent && m.role !== "owner";
              return (
                <tr key={m.id} className="group border-b border-line last:border-0 hover:bg-bg-sunken/50">
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
                    {removable ? (
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
                            <div className="absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-xl border border-line bg-bg-elev py-1 text-left shadow-[var(--shadow-lg)]">
                              <button
                                onClick={() => { setMenuFor(null); setRemoving(m); }}
                                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-medium text-erro hover:bg-bg-sunken"
                              >
                                <Trash2 className="size-4" /> Remover membro
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <Button variant="ghost" size="sm" disabled>
                        {m.role === "owner" ? "Owner" : "Editar"}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

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
