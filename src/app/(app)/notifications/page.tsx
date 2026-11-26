import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { NotificationsAdmin, type NotificationListItem } from "@/components/notifications/NotificationsAdmin";
import type { AutoTabData } from "@/components/notifications/AutoNotificationsTab";
import { listNotifications } from "@/lib/db/notifications";
import { integrationOverview, webhookSecretInfo } from "@/lib/db/notification-activities";
import { getPrimaryPublicKey } from "@/lib/db/keys";
import { canManageWorkspace } from "@/lib/auth/current";
import { getAppOrigin } from "@/lib/config/env";
import { displayStatus, isCategory, normalizeAudience } from "@/lib/notifications/model";
import { schoolYearsLabel } from "@/lib/surveys/school-years";
import { timeAgo } from "@/lib/utils";
import { notificationsContext } from "./data";
import { NotificationsUnavailable } from "./Unavailable";

export const dynamic = "force-dynamic";

function audienceLabel(audience: unknown, hosts: unknown): string {
  const a = normalizeAudience(audience);
  const who = a.list.length
    ? `${a.list.length.toLocaleString("pt-BR")} ${a.list.length === 1 ? "estudante" : "estudantes"}`
    : a.schoolYears.length
      ? schoolYearsLabel(a.schoolYears)
      : "Todos os estudantes";
  const h = Array.isArray(hosts) ? hosts.length : 0;
  return h ? `${who} · ${h} ${h === 1 ? "plataforma" : "plataformas"}` : who;
}

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [{ tab }, ctx] = await Promise.all([searchParams, notificationsContext()]);
  const header = (
    <PageHeader
      eyebrow="Notificações"
      title="Notificações"
      description="Recados e avisos automáticos de tarefas, Provas Geniais e prazos, no sino dos estudantes dentro do produto."
      actions={
        ctx.canEdit && ctx.settings ? (
          <Button href="/notifications/new" size="sm">
            <Plus className="size-4" /> Novo recado
          </Button>
        ) : undefined
      }
    />
  );
  if (!ctx.settings) {
    return (
      <div>
        {header}
        <NotificationsUnavailable />
      </div>
    );
  }

  const [rows, overview, secret, publicKey, canManage] = await Promise.all([
    listNotifications(ctx.projectId),
    integrationOverview(ctx.projectId),
    webhookSecretInfo(ctx.projectId),
    getPrimaryPublicKey(ctx.projectId).catch(() => null),
    canManageWorkspace(),
  ]);
  const fmt = (d: Date) =>
    d.toLocaleString("pt-BR", { timeZone: ctx.tz, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(",", "");
  const auto: AutoTabData = {
    available: !!overview && !!secret,
    bellEnabled: ctx.settings.enabled,
    auto: ctx.settings.auto,
    webhookUrl: publicKey ? `${getAppOrigin()}/api/v1/notifications/webhook?key=${publicKey}` : null,
    secret: {
      hasSecret: !!secret?.hasSecret,
      updatedAt: secret?.updatedAt ? fmt(secret.updatedAt) : null,
      previousUntil: secret?.previousUntil ? fmt(secret.previousUntil) : null,
    },
    canEdit: ctx.canEdit,
    canManage,
    summary: {
      open: overview?.open ?? 0,
      total: overview?.total ?? 0,
      lastReceived: overview?.lastReceivedAt ? timeAgo(overview.lastReceivedAt) : null,
      last24h: overview?.last24h ?? {},
    },
    deliveries: (overview?.deliveries ?? []).map((d) => ({ id: d.eventId, when: fmt(d.receivedAt), event: d.event, activityId: d.activityId, status: d.status, error: d.error })),
    activities: (overview?.activities ?? []).map((a) => ({
      id: a.id,
      type: a.type,
      title: a.title,
      subject: a.subject,
      classIds: a.classIds,
      assigned: fmt(a.assignedAt),
      due: a.dueAt ? fmt(a.dueAt) : null,
      state: a.state,
      stats: a.stats,
    })),
  };
  const items: NotificationListItem[] = rows.map((n) => {
    const start = n.publishAt ?? n.publishedAt;
    return {
      id: n.id,
      title: n.title,
      category: isCategory(n.category) ? n.category : "aviso",
      display: displayStatus(n),
      pinned: n.pinned,
      audience: audienceLabel(n.audience, n.hosts),
      period: start && n.expiresAt ? `${fmt(start)} → ${fmt(n.expiresAt)}` : start ? `Desde ${fmt(start)}` : n.expiresAt ? `Até ${fmt(n.expiresAt)}` : "—",
      stats: n.stats,
      updated: `Atualizado ${timeAgo(n.updatedAt)}`,
    };
  });

  return (
    <div>
      {header}
      <NotificationsAdmin
        items={items}
        settings={ctx.settings}
        hosts={ctx.hosts}
        canEdit={ctx.canEdit}
        auto={auto}
        initialTab={tab === "sino" ? "sino" : tab === "auto" ? "auto" : "recados"}
      />
    </div>
  );
}
