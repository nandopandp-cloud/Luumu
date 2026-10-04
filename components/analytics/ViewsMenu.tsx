"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/ui/Link";
import { BarChart3, Check, ChevronDown, Copy, LayoutGrid, Loader2, MoreVertical, PencilLine, Plus, Settings2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { TAB_META, viewHref } from "@/lib/analytics/core";
import type { SavedView } from "@/lib/db/analytics";
import { createViewAction, deleteViewAction, updateViewAction } from "@/app/(app)/analytics/actions";

/*
  Visões personalizadas de CADA usuário (individuais): o seletor "Minhas visões", a tela de
  gerenciamento e as ações de renomear, duplicar e excluir.
*/

export function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return { open, setOpen, ref };
}

const blocksOf = (v: SavedView) => (v.config.tab === "custom" ? `${v.config.widgets?.length ?? 0} blocos` : TAB_META[v.config.tab].label);

/** Ações de uma visão salva com os diálogos que elas abrem. */
export function useViewActions(currentId: string | null) {
  const router = useRouter();
  const toast = useToast();
  const [busy, start] = useTransition();
  const [renaming, setRenaming] = useState<SavedView | null>(null);
  const [deleting, setDeleting] = useState<SavedView | null>(null);

  function duplicate(v: SavedView) {
    start(async () => {
      const r = await createViewAction({ name: `Cópia de ${v.name}`.slice(0, 60), goal: v.goal, shared: false, config: v.config });
      if (!r.ok) return toast("error", r.error);
      toast("success", "Visão duplicada.");
      router.push(viewHref(v.config, r.id), { scroll: false });
    });
  }

  const dialogs = (
    <>
      {renaming && <RenameDialog view={renaming} onClose={() => setRenaming(null)} />}
      {deleting && (
        <Dialog
          title="Excluir visão?"
          description={`“${deleting.name}” será excluída. Isso não apaga nenhum dado do Analytics.`}
          onClose={() => setDeleting(null)}
          footer={
            <>
              <Button variant="ghost" size="sm" onClick={() => setDeleting(null)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={busy}
                onClick={() =>
                  start(async () => {
                    const r = await deleteViewAction(deleting.id);
                    if (!r.ok) return toast("error", r.error);
                    toast("success", "Visão excluída.");
                    const wasCurrent = deleting.id === currentId;
                    setDeleting(null);
                    if (wasCurrent) router.push("/analytics", { scroll: false });
                    else router.refresh();
                  })
                }
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Excluir
              </Button>
            </>
          }
        >
          <span />
        </Dialog>
      )}
    </>
  );
  return { busy, duplicate, rename: setRenaming, remove: setDeleting, dialogs };
}

function RenameDialog({ view, onClose }: { view: SavedView; onClose: () => void }) {
  const [name, setName] = useState(view.name);
  const [goal, setGoal] = useState(view.goal);
  const [busy, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <Dialog
      title="Renomear visão"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={busy || name.trim().length < 2}
            onClick={() =>
              start(async () => {
                const r = await updateViewAction(view.id, { name, goal, shared: false, config: view.config });
                if (!r.ok) return toast("error", r.error);
                toast("success", "Visão renomeada.");
                onClose();
                router.refresh();
              })
            }
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Salvar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-fg-soft">Nome</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="rounded-xl border border-line-strong bg-bg-elev px-3.5 py-2.5 text-sm outline-none transition focus:border-accent" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-fg-soft">Objetivo (opcional)</span>
          <textarea value={goal} onChange={(e) => setGoal(e.target.value)} maxLength={160} rows={2} placeholder="O que esta visão ajuda a acompanhar?" className="resize-none rounded-xl border border-line-strong bg-bg-elev px-3.5 py-2.5 text-sm outline-none transition focus:border-accent" />
        </label>
      </div>
    </Dialog>
  );
}

/** Menu de uma visão: editar layout, renomear, duplicar, excluir. */
function ItemMenu({ onEdit, onRename, onDuplicate, onDelete }: { onEdit: () => void; onRename: () => void; onDuplicate: () => void; onDelete: () => void }) {
  const { open, setOpen, ref } = usePopover();
  const item = (Icon: typeof Copy, label: string, fn: () => void, danger = false) => (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        setOpen(false);
        fn();
      }}
      className={cn("flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition hover:bg-bg-sunken", danger ? "text-erro" : "text-fg-soft")}
    >
      <Icon className="size-4" /> {label}
    </button>
  );
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label="Opções da visão" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="grid size-8 place-items-center rounded-lg text-fg-mut transition hover:bg-bg-sunken hover:text-fg">
        <MoreVertical className="size-4" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-xl border border-line bg-bg-elev py-1 shadow-[var(--shadow-lg)] animate-[luumuSelectIn_.14s_ease-out]">
          {item(LayoutGrid, "Editar layout", onEdit)}
          {item(PencilLine, "Renomear", onRename)}
          {item(Copy, "Duplicar", onDuplicate)}
          <div className="my-1 border-t border-line" />
          {item(Trash2, "Excluir", onDelete, true)}
        </div>
      )}
    </div>
  );
}

/** Pílula "Minhas visões" (referência: Minha visão de produto ▾). */
export function ViewsMenu({
  views,
  current,
  onNew,
  onEdit,
  onManage,
}: {
  views: SavedView[];
  current: SavedView | null;
  onNew: () => void;
  onEdit: (v: SavedView) => void;
  onManage: () => void;
}) {
  const { open, setOpen, ref } = usePopover();
  const actions = useViewActions(current?.id ?? null);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "inline-flex max-w-[280px] items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition",
          current ? "border-accent/40 bg-surface-brand/60 text-accent" : "border-line-strong bg-bg-elev text-fg-soft hover:border-accent/50"
        )}
      >
        <BarChart3 className="size-4 shrink-0" />
        <span className="truncate">{current?.name ?? "Minhas visões"}</span>
        <ChevronDown className={cn("size-4 shrink-0 transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-40 mt-2 w-[330px] rounded-2xl border border-line bg-bg-elev p-2 shadow-[var(--shadow-lg)] animate-[luumuSelectIn_.14s_ease-out]">
          <div className="px-2.5 pb-1.5 pt-1.5 text-sm font-bold">Minhas visões</div>
          <div className="max-h-[320px] overflow-y-auto">
            {views.length === 0 ? (
              <p className="px-2.5 py-3 text-xs leading-relaxed text-fg-mut">Você ainda não tem visões. Monte uma com os blocos que importam para o seu objetivo.</p>
            ) : (
              views.map((v) => {
                const active = v.id === current?.id;
                return (
                  <div key={v.id} className={cn("flex items-center gap-1 rounded-xl", active && "bg-surface-brand/50")}>
                    <Link href={viewHref(v.config, v.id)} onClick={() => setOpen(false)} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2.5 py-2 transition hover:bg-bg-sunken">
                      <BarChart3 className={cn("size-4 shrink-0", active ? "text-accent" : "text-fg-mut")} />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate text-sm font-semibold", active && "text-accent")}>{v.name}</span>
                        <span className="block truncate text-[11px] text-fg-mut">{v.goal || blocksOf(v)}</span>
                      </span>
                      {active && (
                        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent text-white">
                          <Check className="size-3" />
                        </span>
                      )}
                    </Link>
                    <ItemMenu
                      onEdit={() => {
                        setOpen(false);
                        onEdit(v);
                      }}
                      onRename={() => actions.rename(v)}
                      onDuplicate={() => actions.duplicate(v)}
                      onDelete={() => actions.remove(v)}
                    />
                  </div>
                );
              })
            )}
          </div>
          <div className="mt-1.5 flex flex-col gap-1 border-t border-line pt-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onNew();
              }}
              className="flex items-center justify-center gap-2 rounded-xl bg-surface-brand/70 px-3 py-2.5 text-sm font-semibold text-accent transition hover:bg-surface-brand"
            >
              <Plus className="size-4" /> Nova visão personalizada
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onManage();
              }}
              className="flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-fg-soft transition hover:bg-bg-sunken"
            >
              <Settings2 className="size-4" /> Gerenciar visões
            </button>
          </div>
        </div>
      )}
      {actions.dialogs}
    </div>
  );
}

/** Todas as visões do usuário num lugar só. */
export function ManageViewsDialog({
  views,
  currentId,
  onClose,
  onEdit,
  onNew,
}: {
  views: SavedView[];
  currentId: string | null;
  onClose: () => void;
  onEdit: (v: SavedView) => void;
  onNew: () => void;
}) {
  const actions = useViewActions(currentId);
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).replace(".", "");
  return (
    <Dialog
      title="Minhas visões"
      description="Suas visões personalizadas. Só você as vê; para mostrar a alguém, use Compartilhar (copia o link com os blocos e filtros)."
      size="lg"
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto text-sm text-fg-mut">
            {views.length} {views.length === 1 ? "visão" : "visões"}
          </span>
          <Button
            size="sm"
            onClick={() => {
              onClose();
              onNew();
            }}
          >
            <Plus className="size-4" /> Nova visão
          </Button>
        </>
      }
    >
      {views.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line px-6 py-10 text-center">
          <LayoutGrid className="size-7 text-accent" />
          <p className="font-display font-bold">Nenhuma visão ainda</p>
          <p className="max-w-sm text-sm text-fg-mut">Monte uma visão com indicadores, gráficos e tabelas e dê a ela um nome para voltar quando quiser.</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line">
          {views.map((v) => (
            <li key={v.id} className={cn("flex items-center gap-3 px-4 py-3", v.id === currentId && "bg-surface-brand/30")}>
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-brand text-accent">
                <BarChart3 className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold">{v.name}</span>
                  {v.id === currentId && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-white">aberta</span>}
                </div>
                <div className="truncate text-xs text-fg-mut">
                  {v.goal ? `${v.goal} · ` : ""}
                  {blocksOf(v)} · atualizada em {fmt(v.updatedAt)}
                </div>
              </div>
              <Link href={viewHref(v.config, v.id)} onClick={onClose} className="hidden rounded-lg px-3 py-1.5 text-sm font-semibold text-accent transition hover:bg-surface-brand sm:block">
                Abrir
              </Link>
              <ItemMenu
                onEdit={() => {
                  onClose();
                  onEdit(v);
                }}
                onRename={() => actions.rename(v)}
                onDuplicate={() => actions.duplicate(v)}
                onDelete={() => actions.remove(v)}
              />
            </li>
          ))}
        </ul>
      )}
      {actions.dialogs}
    </Dialog>
  );
}
