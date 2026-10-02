"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Copy, Archive, ArchiveRestore, Trash2, BarChart3, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { HostBadge } from "@/components/ui/HostBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { deleteTourAction, duplicateTourAction, setTourStatusAction } from "@/app/(app)/tours/actions";
import type { TourListItem } from "@/lib/db/tours";

export type TourRow = Omit<TourListItem, "updatedAt"> & { updatedAtLabel: string; updatedAt?: undefined };

export function TourStatusBadge({ status, version, dirty }: { status: TourListItem["status"]; version: number | null; dirty?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {status === "published" ? (
        <Badge tone="success">Publicado{version ? ` · v${version}` : ""}</Badge>
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
      <EmptyState
        mascot="Apresentando"
        title="Nenhum tour ainda"
        description="Abra seu produto, clique no que quer explicar, escreva a mensagem e publique. Seu primeiro tour fica pronto em poucos minutos."
        action={newTour}
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
                <th className="px-6 py-3 font-semibold">Tour</th>
                {multiHost && <th className="px-3 py-3 font-semibold">Plataforma</th>}
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Passos</th>
                <th className="px-3 py-3 font-semibold">Iniciaram</th>
                <th className="px-3 py-3 font-semibold">Conclusão</th>
                <th className="px-3 py-3 font-semibold">Criado por</th>
                <th className="px-6 py-3 text-right font-semibold">Atualizado</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => {
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
                icon={<Copy className="size-4" />}
                onClick={() => run(() => duplicateTourAction(current.id), "Tour duplicado.", (id) => id && router.push(`/tours/${id}`))}
              >
                Duplicar
              </MenuItem>
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
