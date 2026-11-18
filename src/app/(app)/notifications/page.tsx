import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { NotificationsAdmin, type NotificationListItem } from "@/components/notifications/NotificationsAdmin";
import { listNotifications } from "@/lib/db/notifications";
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
      description="Recados que aparecem no sino dos estudantes, dentro do produto. Em breve: avisos automáticos de novas tarefas, provas e prazos."
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

  const rows = await listNotifications(ctx.projectId);
  const fmt = (d: Date) =>
    d.toLocaleString("pt-BR", { timeZone: ctx.tz, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(",", "");
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
      <NotificationsAdmin items={items} settings={ctx.settings} hosts={ctx.hosts} canEdit={ctx.canEdit} initialTab={tab === "sino" ? "sino" : "recados"} />
    </div>
  );
}
