import { redirect } from "next/navigation";
import { NotificationEditor } from "@/components/notifications/NotificationEditor";
import { defaultExpires, notificationsContext } from "../data";
import { NotificationsUnavailable } from "../Unavailable";

export const dynamic = "force-dynamic";

export default async function NewNotificationPage() {
  const ctx = await notificationsContext();
  if (!ctx.settings) return <NotificationsUnavailable />;
  // leitores só veem a lista
  if (!ctx.canEdit) redirect("/notifications");
  return (
    <NotificationEditor
      initial={{ title: "", body: "", category: "aviso", ctaLabel: "", ctaUrl: "", schoolYears: [], list: [], hosts: [], pinned: false, publishAt: "", expiresAt: "", status: "rascunho" }}
      hosts={ctx.hosts}
      testers={ctx.settings.testers.length}
      accent={ctx.settings.accent}
      emptyText={ctx.settings.emptyText}
      canEdit
      bellEnabled={ctx.settings.enabled}
      defaultExpires={defaultExpires(ctx.tz)}
    />
  );
}
