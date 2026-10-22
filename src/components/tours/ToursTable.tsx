"use client";

import { IllustratedState } from "@/components/ui/IllustratedState";
import { ToursEmptyArt } from "@/components/illustrations/EmptyArt";
import { Layers, MousePointer2, PlayCircle, Users } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { SortTh, useTableSort } from "@/components/ui/SortableHeader";
import { createPortal } from "react-dom";
import Link from "@/components/ui/Link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, PencilLine, Copy, Archive, ArchiveRestore, Trash2, BarChart3, Loader2, Pause, Play } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { HostBadge } from "@/components/ui/HostBadge";
import { HostPicker } from "@/components/ui/HostPicker";
import { Field, Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { deleteTourAction, duplicateTourAction, renameTourAction, setTourStatusAction } from "@/app/(app)/tours/actions";
import type { TourListItem } from "@/lib/db/tours";

export type TourRow = Omit<TourListItem, "updatedAt"> & { updatedAtLabel: string; updatedAt?: undefined };

export function TourStatusBadge({ status, version, dirty }: { status: TourListItem["status"]; version: number | null; dirty?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {status === "published" ? (
        <Badge tone="success">Publicado{version ? ` · v${version}` : ""}</Badge>
      ) : status === "paused" ? (
        <Badge tone="warn">Pausado{version ? ` · v${version}` : ""}</Badge>
      ) : status === "archived" ? (
        <Badge tone="neutral">Arquivado</Badge>
      ) : (
        <Badge tone="brand">Rascunho</Badge>
      )}
      {dirty && status !== "draft" && (
        <span className="text-[11px] font-semibold text-aviso" title="O rascunho tem mudanças que ainda não estão no ar">
          alterações não publicadas
        </span>
      )}
    </span>
  );
}

export function ToursTable({ items, hosts, newTour }: { items: TourRow[]; hosts: string[]; newTour: React.ReactNode }) {
  const [menu, setMenu] = useState<{ id: string; top: number; right: number } | null>(null);
  const [deleting, setDeleting] = useState<TourRow | null>(null);
  const [duplicating, setDuplicating] = useState<{ tour: TourRow; name: string; targetHosts: string[] } | null>(null);
  const [renaming, setRenaming] = useState<{ tour: TourRow; name: string } | null>(null);
  // "Atualizado" usa a ordem do servidor (mais recente primeiro)
  const position = new Map(items.map((x, i) => [x.id, items.length - i]));
  const { sorted, sort, toggle } = useTableSort(items, {
    name: (t) => t.name,
    status: (t) => t.status,
    steps: (t) => t.stepCount,
    started: (t) => t.started,
    rate: (t) => (t.started ? t.completed / t.started : null),
    creator: (t) => t.creator?.name ?? null,
    updated: (t) => position.get(t.id) ?? null,
  });
  const [busy, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menu]);

  if (items.length === 0) {
    return (
      <IllustratedState
        className="pt-2"
        wideActions
        art={<ToursEmptyArt className="w-full" />}
        title="Ainda não há tours por aqui"
        description="Crie tours guiados para apresentar as principais funcionalidades do seu produto e oferecer uma melhor experiência aos seus usuários."
        actions={
          <div className="flex flex-col gap-3 sm:flex-row [&>*]:w-full [&_button]:w-full [&_button]:justify-center">
            {newTour}
            <Button href="/help?a=o-que-e-tour" variant="ghost" className="w-full justify-center">
              <PlayCircle className="size-4" /> Ver exemplos de tours
            </Button>
          </div>
        }
        steps={[
          { icon: MousePointer2, title: "1. Escolha os passos", text: "Selecione as telas e crie mensagens simples e objetivas." },
          { icon: Layers, title: "2. Personalize", text: "Adicione textos, imagens e destaque os elementos mais importantes." },
          { icon: Users, title: "3. Defina o público", text: "Escolha quem verá o tour (ex.: novos usuários, planos específicos ou segmentos)." },
          { icon: BarChart3, title: "4. Acompanhe os resultados", text: "Veja quantos usuários concluíram o tour e entenda o impacto na adoção do seu produto." },
        ]}
      />
    );
  }

  const current = items.find((t) => t.id === menu?.id);
  const multiHost = hosts.length > 1 || items.some((t) => t.targetHosts.length > 0);

  function run(fn: () => Promise<{ ok: boolean; error?: string; id?: string }>, success: string, go?: (id?: string) => void) {
    setMenu(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) return toast("error", res.error ?? "Não foi possível concluir.");
      toast("success", success);
      if (go) go(res.id);
      else router.refresh();
    });
  }

  return (
    <>
      <Card padded={false} className="overflow-visible">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left font-mono text-[11px] uppercase tracking-wide text-fg-mut">
                <SortTh label="Tour" k="name" sort={sort} onSort={toggle} className="px-6 py-3 font-semibold" />
                {multiHost && <th className="px-3 py-3 font-semibold">Plataforma</th>}
                <SortTh label="Status" k="status" sort={sort} onSort={toggle} className="px-3 py-3 font-semibold" />
                <SortTh label="Passos" k="steps" sort={sort} onSort={toggle} className="px-3 py-3 font-semibold" />
                <SortTh label="Iniciaram" k="started" sort={sort} onSort={toggle} className="px-3 py-3 font-semibold" />
                <SortTh label="Conclusão" k="rate" sort={sort} onSort={toggle} className="px-3 py-3 font-semibold" />
                <SortTh label="Criado por" k="creator" sort={sort} onSort={toggle} className="px-3 py-3 font-semibold" />
                <SortTh label="Atualizado" k="updated" sort={sort} onSort={toggle} align="right" className="px-6 py-3 text-right font-semibold" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => {
                const rate = t.started ? Math.round((t.completed / t.started) * 100) : null;
                return (
                  <tr key={t.id} className="group border-b border-line last:border-0 transition-colors hover:bg-bg-sunken/50">
                    <td className="max-w-[320px] px-6 py-3.5">
                      <Link href={`/tours/${t.id}`} className="font-semibold hover:text-accent">
                        {t.name}
                      </Link>
                      {t.description && <div className="mt-0.5 truncate text-xs text-fg-mut">{t.description}</div>}
                    </td>
                    {multiHost && (
                      <td className="px-3 py-3.5">
                        {t.targetHosts.length ? (
                          <div className="flex max-w-[200px] flex-wrap gap-1">
                            {t.targetHosts.map((h) => (
                              <HostBadge key={h} host={h} all={hosts} />
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-fg-mut">Todas</span>
                        )}
                      </td>
                    )}
                    <td className="px-3 py-3.5">
                      <TourStatusBadge status={t.status} version={t.version} dirty={t.hasUnpublishedChanges} />
                    </td>
                    <td className="px-3 py-3.5 text-fg-soft">{t.stepCount}</td>
                    <td className="px-3 py-3.5 text-fg-soft">{t.started.toLocaleString("pt-BR")}</td>
                    <td className="px-3 py-3.5">
                      {rate === null ? (
                        <span className="text-fg-mut">—</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-bg-sunken">
                            <div className="h-full rounded-full [background:var(--grad-roxo)]" style={{ width: `${rate}%` }} />
                          </div>
                          <span className="font-semibold text-fg-soft">{rate}%</span>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3.5">
                      {t.creator ? (
                        <div className="flex items-center gap-2" title={t.creator.name}>
                          {t.creator.avatarUrl ? (
                            <Image src={t.creator.avatarUrl} alt="" width={24} height={24} className="size-6 rounded-full object-cover" />
                          ) : (
                            <span className="grid size-6 place-items-center rounded-full text-[11px] font-bold text-white [background:var(--grad-marca)]">
                              {t.creator.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                          <span className="max-w-[120px] truncate text-fg-soft">{t.creator.name.split(" ")[0]}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-fg-mut">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-right text-fg-mut">
                      <div className="inline-flex items-center gap-2">
                        <span>{t.updatedAtLabel}</span>
                        <button
                          type="button"
                          aria-label={`Ações de ${t.name}`}
                          onClick={(e) => {
                            const r = e.currentTarget.getBoundingClientRect();
                            setMenu(menu?.id === t.id ? null : { id: t.id, top: r.bottom + 4, right: window.innerWidth - r.right });
                          }}
                          className="rounded-lg p-1.5 hover:bg-bg-sunken hover:text-fg"
                        >
                          {busy && menu?.id === t.id ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {menu &&
        current &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
            <div
              role="menu"
              className="fixed z-50 w-52 overflow-hidden rounded-xl border border-line bg-bg-elev py-1 text-sm shadow-[var(--shadow-lg)]"
              style={{ top: menu.top, right: menu.right }}
            >
              <MenuItem icon={<Pencil className="size-4" />} onClick={() => router.push(`/tours/${current.id}`)}>
                Editar
              </MenuItem>
              <MenuItem icon={<BarChart3 className="size-4" />} onClick={() => router.push(`/tours/${current.id}/analytics`)}>
                Analytics
              </MenuItem>
              <MenuItem
                icon={<PencilLine className="size-4" />}
                onClick={() => {
                  setRenaming({ tour: current, name: current.name });
                  setMenu(null);
                }}
              >
                Renomear…
              </MenuItem>
              <MenuItem
                icon={<Copy className="size-4" />}
                onClick={() => {
                  setDuplicating({ tour: current, name: `${current.name} (cópia)`, targetHosts: current.targetHosts });
                  setMenu(null);
                }}
              >
                Duplicar…
              </MenuItem>
              {current.status === "published" && (
                <MenuItem
                  icon={<Pause className="size-4" />}
                  onClick={() => run(() => setTourStatusAction(current.id, "paused"), "Tour pausado. Ele saiu do ar; retome quando quiser.")}
                >
                  Pausar
                </MenuItem>
              )}
              {current.status === "paused" && (
                <MenuItem
                  icon={<Play className="size-4" />}
                  onClick={() => run(() => setTourStatusAction(current.id, "active"), "Tour retomado. Ele voltou ao ar.")}
                >
                  Retomar
                </MenuItem>
              )}
              {current.status === "archived" ? (
                <MenuItem
                  icon={<ArchiveRestore className="size-4" />}
                  onClick={() => run(() => setTourStatusAction(current.id, "active"), "Tour reativado.")}
                >
                  Reativar
                </MenuItem>
              ) : (
                <MenuItem
                  icon={<Archive className="size-4" />}
                  onClick={() => run(() => setTourStatusAction(current.id, "archived"), "Tour arquivado. Ele saiu do ar.")}
                >
                  Arquivar
                </MenuItem>
              )}
              <div className="my-1 border-t border-line" />
              <MenuItem
                danger
                icon={<Trash2 className="size-4" />}
                onClick={() => {
                  setDeleting(current);
                  setMenu(null);
                }}
              >
                Excluir
              </MenuItem>
            </div>
          </>,
          document.body
        )}

      {duplicating && (
        <Dialog
          title="Duplicar tour"
          description="A cópia nasce como rascunho, fora do ar. Escolha onde ela vai aparecer: ao trocar de plataforma, a URL inicial, os links dos passos e as regras de plataforma passam a apontar para o destino."
          onClose={() => setDuplicating(null)}
          footer={
            <>
              <Button variant="ghost" size="sm" onClick={() => setDuplicating(null)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={!duplicating.name.trim()}
                onClick={() => {
                  const { tour, name, targetHosts } = duplicating;
                  setDuplicating(null);
                  run(
                    () => duplicateTourAction(tour.id, { name: name.trim(), targetHosts }),
                    "Tour duplicado. Revise os passos no builder antes de publicar.",
                    (id) => id && router.push(`/tours/${id}`)
                  );
                }}
              >
                <Copy className="size-4" /> Duplicar
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <Field label="Nome da cópia">
              <Input
                value={duplicating.name}
                maxLength={120}
                onChange={(e) => setDuplicating({ ...duplicating, name: e.target.value })}
              />
            </Field>
            <Field label="Plataforma">
              <HostPicker
                hosts={hosts}
                selected={duplicating.targetHosts}
                onChange={(targetHosts) => setDuplicating({ ...duplicating, targetHosts })}
              />
            </Field>
          </div>
        </Dialog>
      )}

      {renaming && (
        <Dialog
          title="Renomear tour"
          onClose={() => setRenaming(null)}
          footer={
            <>
              <Button variant="ghost" size="sm" onClick={() => setRenaming(null)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={!renaming.name.trim() || renaming.name.trim() === renaming.tour.name}
                onClick={() => {
                  const { tour, name } = renaming;
                  setRenaming(null);
                  run(() => renameTourAction(tour.id, name.trim()), "Tour renomeado.");
                }}
              >
                <PencilLine className="size-4" /> Salvar
              </Button>
            </>
          }
        >
          <Field label="Nome do tour">
            <Input
              value={renaming.name}
              maxLength={120}
              autoFocus
              onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || !renaming.name.trim() || renaming.name.trim() === renaming.tour.name) return;
                const { tour, name } = renaming;
                setRenaming(null);
                run(() => renameTourAction(tour.id, name.trim()), "Tour renomeado.");
              }}
            />
          </Field>
        </Dialog>
      )}

      {deleting && (
        <Dialog
          title="Excluir tour?"
          description={`"${deleting.name}" sai do ar e perde versões e métricas. Isso não pode ser desfeito.`}
          onClose={() => setDeleting(null)}
          footer={
            <>
              <Button variant="ghost" size="sm" onClick={() => setDeleting(null)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  const id = deleting.id;
                  setDeleting(null);
                  run(() => deleteTourAction(id), "Tour excluído.");
                }}
              >
                Excluir
              </Button>
            </>
          }
        >
          <p className="text-sm text-fg-soft">Se só quiser tirar do ar, prefira arquivar: dá para reativar depois.</p>
        </Dialog>
      )}
    </>
  );
}

function MenuItem({
  icon,
  children,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left hover:bg-bg-sunken ${danger ? "text-erro" : "text-fg-soft"}`}
    >
      {icon}
      {children}
    </button>
  );
}
