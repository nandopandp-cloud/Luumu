"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, MoreHorizontal, Pause, Play, Square, Eye, Pencil, Type, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { setStatusAction, renameSurveyAction, deleteSurveyAction } from "@/app/(app)/surveys/actions";
import type { SurveyStatus } from "@/lib/mock/surveys";

export interface SurveyListItem {
  id: string;
  name: string;
  type: string;
  status: SurveyStatus;
  channel: string;
  responseCount: number;
  score: number | null;
  updatedAtLabel: string;
}

const statusTone: Record<SurveyStatus, "success" | "warn" | "neutral" | "brand"> = {
  ativa: "success", pausada: "warn", encerrada: "neutral", rascunho: "brand",
};

type Filter = "todas" | SurveyStatus;

export function SurveysTable({ items }: { items: SurveyListItem[] }) {
  const [filter, setFilter] = useState<Filter>("todas");
  const [q, setQ] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<SurveyListItem | null>(null);
  const [deleting, setDeleting] = useState<SurveyListItem | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const filtered = items.filter(
    (s) => (filter === "todas" || s.status === filter) && s.name.toLowerCase().includes(q.toLowerCase())
  );

  function changeStatus(id: string, status: SurveyStatus, label: string) {
    setMenuFor(null);
    startTransition(async () => {
      await setStatusAction(id, status);
      toast("success", label);
      router.refresh();
    });
  }

  function doRename(name: string) {
    if (!renaming) return;
    const target = renaming;
    startTransition(async () => {
      const res = await renameSurveyAction({ id: target.id, name });
      if (res.ok) {
        toast("success", "Pesquisa renomeada.");
        setRenaming(null);
        router.refresh();
      } else {
        toast("error", res.error ?? "Não foi possível renomear.");
      }
    });
  }

  function doDelete() {
    if (!deleting) return;
    const target = deleting;
    startTransition(async () => {
      await deleteSurveyAction(target.id);
      toast("success", "Pesquisa excluída.");
      setDeleting(null);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedControl<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: "todas", label: "Todas" },
            { value: "ativa", label: "Ativas" },
            { value: "rascunho", label: "Rascunhos" },
            { value: "pausada", label: "Pausadas" },
            { value: "encerrada", label: "Encerradas" },
          ]}
        />
        <div className="relative sm:w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-mut" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pesquisa…" className="pl-9" />
        </div>
      </div>

      <Card padded={false} className="overflow-visible">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left font-mono text-[11px] uppercase tracking-wide text-fg-mut">
                <th className="px-6 py-3 font-semibold">Pesquisa</th>
                <th className="px-3 py-3 font-semibold">Tipo</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Canal</th>
                <th className="px-3 py-3 font-semibold">Respostas</th>
                <th className="px-3 py-3 font-semibold">Score</th>
                <th className="px-6 py-3 text-right font-semibold">Atualizada</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="group border-b border-line last:border-0 transition-colors hover:bg-bg-sunken/50">
                  <td className="px-6 py-3.5">
                    <Link href={`/surveys/${s.id}/builder`} className="font-semibold hover:text-accent">{s.name}</Link>
                  </td>
                  <td className="px-3 py-3.5"><Badge tone="brand" dot={false}>{s.type}</Badge></td>
                  <td className="px-3 py-3.5"><Badge tone={statusTone[s.status]}>{s.status}</Badge></td>
                  <td className="px-3 py-3.5 text-fg-soft">{s.channel}</td>
                  <td className="px-3 py-3.5 text-fg-soft">{s.responseCount}</td>
                  <td className="px-3 py-3.5 font-bold text-luumu-roxo">{s.score ?? "—"}</td>
                  <td className="px-6 py-3.5 text-right text-fg-mut">
                    <div className="relative inline-flex items-center gap-2">
                      <span>{s.updatedAtLabel}</span>
                      <button
                        onClick={() => setMenuFor(menuFor === s.id ? null : s.id)}
                        className="rounded p-1 opacity-0 transition hover:bg-bg-sunken group-hover:opacity-100 aria-expanded:opacity-100"
                        aria-label="Ações"
                        aria-expanded={menuFor === s.id}
                      >
                        <MoreHorizontal className="size-4" />
                      </button>
                      {menuFor === s.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                          <div className="absolute right-0 top-8 z-20 w-44 overflow-hidden rounded-xl border border-line bg-bg-elev py-1 text-left shadow-[var(--shadow-lg)]">
                            <MenuLink href={`/surveys/${s.id}/builder`} icon={<Pencil className="size-4" />}>Editar</MenuLink>
                            <MenuBtn onClick={() => { setMenuFor(null); setRenaming(s); }} icon={<Type className="size-4" />}>Renomear</MenuBtn>
                            <MenuLink href={`/surveys/${s.id}/preview`} icon={<Eye className="size-4" />}>Preview</MenuLink>
                            {s.status === "ativa" && (
                              <MenuBtn onClick={() => changeStatus(s.id, "pausada", "Pesquisa pausada.")} icon={<Pause className="size-4" />}>Pausar</MenuBtn>
                            )}
                            {s.status === "pausada" && (
                              <MenuBtn onClick={() => changeStatus(s.id, "ativa", "Pesquisa reativada.")} icon={<Play className="size-4" />}>Reativar</MenuBtn>
                            )}
                            {(s.status === "ativa" || s.status === "pausada") && (
                              <MenuBtn onClick={() => changeStatus(s.id, "encerrada", "Pesquisa encerrada.")} icon={<Square className="size-4" />}>Encerrar</MenuBtn>
                            )}
                            <div className="my-1 border-t border-line" />
                            <MenuBtn onClick={() => { setMenuFor(null); setDeleting(s); }} icon={<Trash2 className="size-4" />} danger>Excluir</MenuBtn>
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-fg-mut">Nenhuma pesquisa encontrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {renaming && (
        <RenameDialog
          initial={renaming.name}
          onCancel={() => setRenaming(null)}
          onConfirm={doRename}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Excluir pesquisa?"
          survey={deleting}
          onCancel={() => setDeleting(null)}
          onConfirm={doDelete}
        />
      )}
    </div>
  );
}

function Backdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-line bg-bg-elev p-6 shadow-[var(--shadow-lg)]">
        {children}
      </div>
    </div>
  );
}

function RenameDialog({ initial, onCancel, onConfirm }: { initial: string; onCancel: () => void; onConfirm: (name: string) => void }) {
  const [name, setName] = useState(initial);
  const [saving, start] = useTransition();
  const valid = name.trim().length > 0 && name.trim() !== initial;
  return (
    <Backdrop onClose={onCancel}>
      <h3 className="font-display text-lg font-bold">Renomear pesquisa</h3>
      <p className="mt-1 text-sm text-fg-mut">Dê um novo nome a esta pesquisa.</p>
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && valid) start(() => onConfirm(name.trim())); }}
        className="mt-4"
        placeholder="Nome da pesquisa"
      />
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" disabled={!valid || saving} onClick={() => start(() => onConfirm(name.trim()))}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : null} Salvar
        </Button>
      </div>
    </Backdrop>
  );
}

function ConfirmDialog({ title, survey, onCancel, onConfirm }: { title: string; survey: SurveyListItem; onCancel: () => void; onConfirm: () => void }) {
  const [saving, start] = useTransition();
  return (
    <Backdrop onClose={onCancel}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-erro/12 text-erro">
          <AlertTriangle className="size-5" />
        </span>
        <div>
          <h3 className="font-display text-lg font-bold">{title}</h3>
          <p className="mt-1 text-sm text-fg-soft">
            A pesquisa <strong>{survey.name}</strong>
            {survey.responseCount > 0 ? (
              <> e suas <strong>{survey.responseCount} {survey.responseCount === 1 ? "resposta" : "respostas"}</strong> serão excluídas permanentemente.</>
            ) : (
              <> será excluída permanentemente.</>
            )}{" "}
            Esta ação não pode ser desfeita.
          </p>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button variant="danger" size="sm" disabled={saving} onClick={() => start(onConfirm)}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Excluir
        </Button>
      </div>
    </Backdrop>
  );
}

function MenuLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-fg-soft hover:bg-bg-sunken">
      {icon} {children}
    </Link>
  );
}

function MenuBtn({ onClick, icon, children, danger }: { onClick: () => void; icon: React.ReactNode; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn("flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-medium hover:bg-bg-sunken", danger ? "text-erro" : "text-fg-soft")}
    >
      {icon} {children}
    </button>
  );
}
