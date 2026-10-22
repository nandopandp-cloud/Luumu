"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FolderKanban, Plus, MoreHorizontal, Type, Trash2, Loader2, AlertTriangle, Upload, Pencil, Globe, X } from "lucide-react";
import { Card, CardTitle, CardSubtitle } from "@/components/ui/Card";
import { LogoImage } from "@/components/ui/LogoImage";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { ImageCropper, useImageCropper } from "@/components/ui/ImageCropper";
import {
  createProjectAction,
  renameProjectAction,
  deleteProjectAction,
  setProjectDomainsAction,
} from "@/app/(app)/projects/actions";

export interface ProjectItem {
  id: string;
  name: string;
  surveyCount: number;
  logoUrl: string | null;
  /** URLs autorizadas do projeto (allowlist da SDK key); [] = sem restrição */
  domains: string[];
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
  const [editing, setEditing] = useState<ProjectItem | null>(null);
  const [deleting, setDeleting] = useState<ProjectItem | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const cropper = useImageCropper();

  const isLast = projects.length <= 1;

  async function onLogoPick(projectId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;

    // SVG é vetorial: recortar em canvas rasterizaria a logo à toa. Sobe direto, como antes.
    let toUpload: File = picked;
    if (picked.type !== "image/svg+xml") {
      const result = await cropper.open(picked);
      if (!result) return; // cancelado no editor
      toUpload = new File([result.blob], "logo.png", { type: "image/png" });
      URL.revokeObjectURL(result.previewUrl);
    }

    setUploadingId(projectId);
    try {
      const fd = new FormData();
      fd.append("file", toUpload);
      const res = await fetch(`/api/projects/${projectId}/logo`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha no upload.");
      toast("success", "Logo do projeto atualizada.");
      router.refresh();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Falha no upload.");
    } finally {
      setUploadingId(null);
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
                  <LogoImage src={p.logoUrl} alt="" width={36} height={36} className="size-9 object-cover" />
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
                <div className="flex items-center gap-1.5 text-xs text-fg-mut">
                  <span>{p.surveyCount} {p.surveyCount === 1 ? "pesquisa" : "pesquisas"}</span>
                  <span aria-hidden>·</span>
                  {p.domains.length > 0 ? (
                    <span className="truncate" title={p.domains.join(", ")}>
                      {p.domains[0]}
                      {p.domains.length > 1 && ` +${p.domains.length - 1}`}
                    </span>
                  ) : (
                    <span className="text-fg-mut/70">qualquer URL</span>
                  )}
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
                        onClick={() => { setMenuFor(null); setEditing(p); }}
                        className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-medium text-fg-soft hover:bg-bg-sunken"
                      >
                        <Pencil className="size-4" /> Editar URL
                      </button>
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

      {editing && (
        <DomainsDialog project={editing} onClose={() => setEditing(null)} />
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

      {cropper.file && (
        <ImageCropper
          file={cropper.file}
          shape="square"
          title="Ajustar logo do projeto"
          onDone={cropper.close}
        />
      )}
    </Card>
  );
}

/**
 * Edição das URLs autorizadas do projeto. A lista alimenta a allowlist de CORS da
 * SDK key: uma URL errada aqui faz o SDK do cliente ser recusado com 403 e o projeto
 * nunca receber eventos — por isso a tela deixa o estado atual explícito.
 */
function DomainsDialog({ project, onClose }: { project: ProjectItem; onClose: () => void }) {
  const [list, setList] = useState<string[]>(project.domains.length ? project.domains : [""]);
  const [saving, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const update = (i: number, v: string) => setList(list.map((d, n) => (n === i ? v : d)));
  const remove = (i: number) => {
    const next = list.filter((_, n) => n !== i);
    setList(next.length ? next : [""]);
  };

  function save() {
    start(async () => {
      const res = await setProjectDomainsAction(project.id, { domains: list });
      if (res.ok) {
        toast("success", "URLs do projeto atualizadas.");
        onClose();
        router.refresh();
      } else {
        toast("error", res.error ?? "Não foi possível salvar.");
      }
    });
  }

  const filled = list.filter((d) => d.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-bg-elev p-6 shadow-[var(--shadow-lg)]">
        <h3 className="font-display text-lg font-bold">URLs do projeto</h3>
        <p className="mt-1 text-sm text-fg-mut">
          Onde o SDK de <strong>{project.name}</strong> pode rodar. Só estas origens conseguem
          enviar eventos e respostas. Subdomínios são aceitos automaticamente: informar{" "}
          <code className="rounded bg-bg-sunken px-1 py-0.5 text-xs">site.com</code> libera{" "}
          <code className="rounded bg-bg-sunken px-1 py-0.5 text-xs">app.site.com</code>.
        </p>

        <div className="mt-4 flex flex-col gap-2">
          {list.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={d}
                onChange={(e) => update(i, e.target.value)}
                placeholder="app.seusite.com"
                disabled={saving}
              />
              <button
                type="button"
                onClick={() => remove(i)}
                disabled={saving}
                aria-label="Remover URL"
                className="rounded-lg p-2 text-fg-mut transition hover:bg-bg-sunken disabled:opacity-40"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>

        <Button
          size="sm"
          variant="subtle"
          className="mt-2"
          disabled={saving}
          onClick={() => setList([...list, ""])}
        >
          <Plus className="size-4" /> Adicionar URL
        </Button>

        {filled.length === 0 && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-bg-sunken p-3 text-xs text-fg-soft">
            <Globe className="mt-0.5 size-3.5 shrink-0" />
            Sem nenhuma URL, o projeto aceita eventos de qualquer origem.
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null} Salvar URLs
          </Button>
        </div>
      </div>
    </div>
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
