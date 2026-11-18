import { NotificationEditor } from "@/components/notifications/NotificationEditor";
import { defaultExpires, editorValues, notificationsContext } from "../data";
import { NotificationsUnavailable } from "../Unavailable";

export const dynamic = "force-dynamic";

export default async function EditNotificationPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, ctx] = await Promise.all([params, notificationsContext()]);
  if (!ctx.settings) return <NotificationsUnavailable />;
  const initial = await editorValues(id, ctx.projectId, ctx.tz);
  return (
    <NotificationEditor
      initial={initial}
      hosts={ctx.hosts}
      testers={ctx.settings.testers.length}
      accent={ctx.settings.accent}
      emptyText={ctx.settings.emptyText}
      canEdit={ctx.canEdit}
      bellEnabled={ctx.settings.enabled}
      defaultExpires={defaultExpires(ctx.tz)}
    />
  );
}
