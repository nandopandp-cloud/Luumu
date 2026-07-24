"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { FolderKanban, Plus, MoreHorizontal, Type, Trash2, Loader2, AlertTriangle, Upload } from "lucide-react";
import { Card, CardTitle, CardSubtitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { createProjectAction, renameProjectAction, deleteProjectAction } from "@/app/(app)/projects/actions";

export interface ProjectItem {
  id: string;
  name: string;
  surveyCount: number;
  logoUrl: string | null;
}

export function ProjectsCard({
  projects,
  activeProjectId,
  canManage,
}: {
  projects: ProjectItem[];
  activeProjectId: string | null;
  canManage: boolean;
}) {
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<ProjectItem | null>(null);
  const [deleting, setDeleting] = useState<ProjectItem | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const isLast = projects.length <= 1;

  async function onLogoPick(projectId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingId(projectId);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/projects/${projectId}/logo`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha no upload.");
      toast("success", "Logo do projeto atualizada.");
      router.refresh();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Falha no upload.");
    } finally {
      setUploadingId(null);
      e.target.value = "";
    }
  }

  function doDelete() {
    if (!deleting) return;
    const target = deleting;
    start(async () => {
      const res = await deleteProjectAction(target.id);
      if (res.ok) {
        toast("success", "Projeto excluído.");
        setDeleting(null);
        router.refresh();
      } else {
        toast("error", res.error ?? "Não foi possível excluir.");
      }
    });
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderKanban className="size-4 text-accent" />
          <CardTitle>Projetos</CardTitle>
        </div>
        {canManage && (
          <Button size="sm" variant="subtle" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Novo projeto
          </Button>
        )}
      </div>
      <CardSubtitle>Cada projeto tem sua própria SDK key, pesquisas e eventos.</CardSubtitle>

      <div className="mt-4 flex flex-col gap-2">
        {projects.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-xl border border-line p-3">
            <div className="flex min-w-0 items-center gap-3">
              <input
                ref={(el) => { fileRefs.current[p.id] = el; }}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden"
                onChange={(e) => onLogoPick(p.id, e)}
                disabled={!canManage}
              />
              <button
                type="button"
                onClick={() => canManage && fileRefs.current[p.id]?.click()}
                disabled={!canManage}
                title={canManage ? "Alterar logo do projeto" : undefined}
                className="group relative size-9 shrink-0 overflow-hidden rounded-lg disabled:cursor-default"
              >
                {p.logoUrl ? (
                  <Image src={p.logoUrl} alt="" width={36} height={36} className="size-9 object-cover" />
                ) : (
                  <span className="grid size-9 place-items-center bg-surface-brand text-sm font-bold text-accent">
                    {p.name.charAt(0).toUpperCase()}
                  </span>
                )}
                {canManage && (
                  <span className="absolute inset-0 hidden items-center justify-center bg-black/50 group-hover:flex">
                    {uploadingId === p.id ? (
                      <Loader2 className="size-3.5 animate-spin text-white" />
                    ) : (
                      <Upload className="size-3.5 text-white" />
                    )}
                  </span>
                )}
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold">{p.name}</span>
                  {p.id === activeProjectId && <Badge tone="brand" dot={false}>ativo</Badge>}
                </div>
                <div className="text-xs text-fg-mut">
                  {p.surveyCount} {p.surveyCount === 1 ? "pesquisa" : "pesquisas"}
                </div>
              </div>
            </div>
            {canManage && (
              <div className="relative">
                <button
                  onClick={() => setMenuFor(menuFor === p.id ? null : p.id)}
                  className="rounded-lg p-1.5 text-fg-mut transition hover:bg-bg-sunken"
                  aria-label="Ações"
                >
                  <MoreHorizontal className="size-4" />
                </button>
                {menuFor === p.id && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                    <div className="absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-xl border border-line bg-bg-elev py-1 text-left shadow-[var(--shadow-lg)]">
                      <button
                        onClick={() => { setMenuFor(null); setRenaming(p); }}
                        className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-medium text-fg-soft hover:bg-bg-sunken"
                      >
                        <Type className="size-4" /> Renomear
                      </button>
                      <button
                        onClick={() => { setMenuFor(null); if (!isLast) setDeleting(p); }}
                        disabled={isLast}
                        title={isLast ? "O workspace precisa de ao menos um projeto" : undefined}
                        className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-medium text-erro hover:bg-bg-sunken disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 className="size-4" /> Excluir
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {creating && (
        <NameDialog
          title="Novo projeto"
          description="Um novo projeto nasce com sua própria SDK key. Instale o script dele no produto correspondente."
          confirmLabel="Criar projeto"
          onCancel={() => setCreating(false)}
          onConfirm={(name) =>
            start(async () => {
              const res = await createProjectAction({ name });
              if (res.ok) {
                toast("success", "Projeto criado.");
                setCreating(false);
                router.refresh();
              } else {
                toast("error", res.error ?? "Não foi possível criar.");
              }
            })
          }
        />
      )}

      {renaming && (
        <NameDialog
          title="Renomear projeto"
          initial={renaming.name}
          confirmLabel="Salvar"
          onCancel={() => setRenaming(null)}
          onConfirm={(name) =>
            start(async () => {
              const res = await renameProjectAction(renaming.id, { name });
              if (res.ok) {
                toast("success", "Projeto renomeado.");
                setRenaming(null);
                router.refresh();
              } else {
                toast("error", res.error ?? "Não foi possível renomear.");
              }
            })
          }
        />
      )}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleting(null)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-line bg-bg-elev p-6 shadow-[var(--shadow-lg)]">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-erro/12 text-erro">
                <AlertTriangle className="size-5" />
              </span>
              <div>
                <h3 className="font-display text-lg font-bold">Excluir projeto?</h3>
                <p className="mt-1 text-sm text-fg-soft">
                  O projeto <strong>{deleting.name}</strong>, sua SDK key,
                  {deleting.surveyCount > 0 && (
                    <> suas <strong>{deleting.surveyCount} {deleting.surveyCount === 1 ? "pesquisa" : "pesquisas"}</strong>,</>
                  )}{" "}
                  eventos e respostas serão excluídos permanentemente. Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDeleting(null)}>Cancelar</Button>
              <Button variant="danger" size="sm" onClick={doDelete}>
                <Trash2 className="size-4" /> Excluir
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function NameDialog({
  title,
  description,
  initial = "",
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  description?: string;
  initial?: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: (name: string) => void;
}) {
  const [name, setName] = useState(initial);
  const [saving, start] = useTransition();
  const valid = name.trim().length >= 2 && name.trim() !== initial;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-line bg-bg-elev p-6 shadow-[var(--shadow-lg)]">
        <h3 className="font-display text-lg font-bold">{title}</h3>
        {description && <p className="mt-1 text-sm text-fg-mut">{description}</p>}
        <Field label="Nome do projeto" className="mt-4">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && valid) start(() => onConfirm(name.trim())); }}
            placeholder="Ex.: App Mobile, Site Institucional…"
          />
        </Field>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
          <Button size="sm" disabled={!valid || saving} onClick={() => start(() => onConfirm(name.trim()))}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null} {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
