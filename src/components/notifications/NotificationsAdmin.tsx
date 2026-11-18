"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Archive, BellRing, Copy, Eye, MoreHorizontal, MousePointerClick, Pencil, Pin, Send, Trash2, Undo2, Users } from "lucide-react";
import Link from "@/components/ui/Link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { DISPLAY_STATUS_LABEL, type BellSettings, type NotificationCategory, type NotificationDisplayStatus } from "@/lib/notifications/model";
import { deleteNotificationAction, duplicateNotificationAction, setNotificationStatusAction } from "@/app/(app)/notifications/actions";
import { CategoryIcon } from "./BellPreview";
import { BellSettingsForm } from "./BellSettingsForm";

export interface NotificationListItem {
  id: string;
  title: string;
  category: NotificationCategory;
  display: NotificationDisplayStatus;
  pinned: boolean;
  audience: string;
  period: string;
  stats: { delivered: number; seen: number; click: number };
  updated: string;
}

const tone: Record<NotificationDisplayStatus, "success" | "warn" | "neutral" | "brand" | "info"> = {
  no_ar: "success",
  agendada: "info",
  teste: "warn",
  rascunho: "brand",
  expirada: "neutral",
  arquivada: "neutral",
};

const fmt = (n: number) => n.toLocaleString("pt-BR");

export function NotificationsAdmin({
  items,
  settings,
  hosts,
  canEdit,
  initialTab,
}: {
  items: NotificationListItem[];
  settings: BellSettings;
  hosts: string[];
  canEdit: boolean;
  initialTab: "recados" | "sino";
}) {
  const [tab, setTab] = useState<string>(initialTab);
  const live = items.filter((i) => i.display === "no_ar");
  const seen = items.reduce((a, i) => a + i.stats.seen, 0);
  const clicks = items.reduce((a, i) => a + i.stats.click, 0);
  const delivered = items.reduce((a, i) => a + i.stats.delivered, 0);

  return (
    <div>
      {!settings.enabled && (
        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-line bg-surface-brand px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <BellRing className="mt-0.5 size-5 shrink-0 text-accent" />
            <div className="text-sm">
              <strong>O sino ainda não está ligado neste projeto.</strong>
              <span className="block text-fg-mut">Ligue e escolha onde ele aparece. Até lá, os recados ficam guardados e não chegam aos estudantes.</span>
            </div>
          </div>
          {tab !== "sino" && (
            <Button size="sm" variant="subtle" onClick={() => setTab("sino")}>
              Configurar o sino
            </Button>
          )}
        </div>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<Send className="size-4" />} label="Recados no ar" value={fmt(live.length)} />
        <Stat icon={<Users className="size-4" />} label="Recebidos" value={fmt(delivered)} hint="Estudantes que tiveram o recado no sino (cada um conta uma vez por recado)." />
        <Stat icon={<Eye className="size-4" />} label="Vistos" value={fmt(seen)} hint="Abriram o painel com o recado na lista." />
        <Stat
          icon={<MousePointerClick className="size-4" />}
          label="Cliques"
          value={fmt(clicks)}
          hint="Clicaram no recado ou no botão dele."
          extra={seen ? `${Math.round((clicks / seen) * 100)}% dos vistos` : undefined}
        />
      </div>

      <Tabs
        tabs={[
          { value: "recados", label: `Recados (${items.length})` },
          { value: "sino", label: "Sino e instalação" },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className="mt-5">
        {tab === "recados" ? <RecadosTable items={items} canEdit={canEdit} /> : <BellSettingsForm initial={settings} hosts={hosts} canEdit={canEdit} />}
      </div>
    </div>
  );
}

function Stat({ icon, label, value, hint, extra }: { icon: React.ReactNode; label: string; value: string; hint?: string; extra?: string }) {
  return (
    <Card className="p-4" title={hint}>
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-fg-mut">
        {label} <span>{icon}</span>
      </div>
      <div className="mt-1 font-display text-3xl font-extrabold tracking-tight text-luumu-roxo">{value}</div>
      {extra && <div className="text-xs text-fg-mut">{extra}</div>}
    </Card>
  );
}

function RecadosTable({ items, canEdit }: { items: NotificationListItem[]; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [, start] = useTransition();
  const [menu, setMenu] = useState<{ id: string; top: number; right: number } | null>(null);
  const [deleting, setDeleting] = useState<NotificationListItem | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string; id?: string }>, done: string, go?: (id?: string) => void) {
    setMenu(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) return toast("error", r.error ?? "Não foi possível concluir.");
      toast("success", done);
      if (go) go(r.id);
      else router.refresh();
    });
  }

  if (!items.length) {
    return (
      <Card className="flex flex-col items-center px-6 py-14 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-surface-brand text-accent">
          <BellRing className="size-6" />
        </span>
        <h2 className="mt-4 font-display text-lg font-bold">Nenhum recado ainda</h2>
        <p className="mt-1.5 max-w-md text-sm text-fg-mut">
          Recados são mensagens que aparecem no sino dos estudantes: um simulado no sábado, uma trilha nova, um aviso da escola.
        </p>
        {canEdit && (
          <Button href="/notifications/new" className="mt-5">
            Escrever o primeiro recado
          </Button>
        )}
      </Card>
    );
  }

  const current = menu ? items.find((i) => i.id === menu.id) : null;

  return (
    <Card padded={false} className="overflow-visible">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left font-mono text-[11px] uppercase tracking-wide text-fg-mut">
              <th className="px-6 py-3 font-semibold">Recado</th>
              <th className="px-3 py-3 font-semibold">Status</th>
              <th className="px-3 py-3 font-semibold">Para quem</th>
              <th className="px-3 py-3 font-semibold">Período</th>
              <th className="px-3 py-3 text-right font-semibold">Vistos</th>
              <th className="px-3 py-3 text-right font-semibold">Cliques</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody>
            {items.map((n) => (
              <tr key={n.id} className="group border-b border-line last:border-0 hover:bg-bg-sunken/50">
                <td className="px-6 py-3.5">
                  <div className="flex items-center gap-3">
                    <CategoryIcon category={n.category} size={30} />
                    <div className="min-w-0">
                      <Link href={`/notifications/${n.id}`} className="font-semibold hover:text-accent">
                        {n.title}
                      </Link>
                      <div className="flex items-center gap-1.5 text-xs text-fg-mut">
                        {n.pinned && (
                          <>
                            <Pin className="size-3" /> Fixado ·
                          </>
                        )}{" "}
                        {n.updated}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3.5">
                  <Badge tone={tone[n.display]}>{DISPLAY_STATUS_LABEL[n.display].toLowerCase()}</Badge>
                </td>
                <td className="max-w-[220px] px-3 py-3.5 text-fg-soft">{n.audience}</td>
                <td className="px-3 py-3.5 text-fg-soft">{n.period}</td>
                <td className="px-3 py-3.5 text-right tabular-nums text-fg-soft">{fmt(n.stats.seen)}</td>
                <td className="px-3 py-3.5 text-right tabular-nums text-fg-soft">{fmt(n.stats.click)}</td>
                <td className="px-6 py-3.5 text-right">
                  {canEdit && (
                    <button
                      className="rounded p-1 text-fg-mut opacity-0 transition hover:bg-bg-sunken group-hover:opacity-100 aria-expanded:opacity-100"
                      aria-label="Ações"
                      aria-expanded={menu?.id === n.id}
                      onClick={(e) => {
                        const r = e.currentTarget.getBoundingClientRect();
                        setMenu(menu?.id === n.id ? null : { id: n.id, top: r.bottom + 6, right: window.innerWidth - r.right });
                      }}
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {menu &&
        current &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
            <div style={{ top: menu.top, right: menu.right }} className="fixed z-50 w-48 overflow-hidden rounded-xl border border-line bg-bg-elev py-1 text-left shadow-[var(--shadow-lg)]">
              <MenuItem icon={<Pencil className="size-4" />} onClick={() => router.push(`/notifications/${current.id}`)}>
                Editar
              </MenuItem>
              <MenuItem icon={<Copy className="size-4" />} onClick={() => run(() => duplicateNotificationAction(current.id), "Cópia criada como rascunho.", (id) => router.push(`/notifications/${id}`))}>
                Duplicar
              </MenuItem>
              {(current.display === "rascunho" || current.display === "teste") && (
                <MenuItem icon={<Send className="size-4" />} onClick={() => router.push(`/notifications/${current.id}`)}>
                  Revisar e publicar
                </MenuItem>
              )}
              {(current.display === "no_ar" || current.display === "agendada" || current.display === "teste") && (
                <MenuItem icon={<Archive className="size-4" />} onClick={() => run(() => setNotificationStatusAction({ id: current.id, status: "arquivada" }), "Recado tirado do ar.")}>
                  Tirar do ar
                </MenuItem>
              )}
              {current.display === "arquivada" && (
                <MenuItem icon={<Undo2 className="size-4" />} onClick={() => run(() => setNotificationStatusAction({ id: current.id, status: "rascunho" }), "Recado voltou para rascunho.")}>
                  Voltar para rascunho
                </MenuItem>
              )}
              <div className="my-1 border-t border-line" />
              <MenuItem
                icon={<Trash2 className="size-4" />}
                danger
                onClick={() => {
                  setMenu(null);
                  setDeleting(current);
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
          title="Excluir recado?"
          description={`"${deleting.title}" sai do sino dos estudantes e as métricas dele são apagadas. Esta ação não pode ser desfeita.`}
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
                  run(() => deleteNotificationAction(id), "Recado excluído.");
                }}
              >
                <Trash2 className="size-4" /> Excluir
              </Button>
            </>
          }
        />
      )}
    </Card>
  );
}

function MenuItem({ icon, children, onClick, danger }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-medium hover:bg-bg-sunken ${danger ? "text-erro" : "text-fg-soft"}`}>
      {icon} {children}
    </button>
  );
}
