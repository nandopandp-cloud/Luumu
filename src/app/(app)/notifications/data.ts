import "server-only";
import { notFound } from "next/navigation";
import { canEditContent, getCurrentProjectId, getCurrentWorkspaceId } from "@/lib/auth/current";
import { getWorkspace } from "@/lib/db/workspace";
import { listHosts } from "@/lib/db/hosts";
import { getBellSettings, getNotification } from "@/lib/db/notifications";
import { isCategory, normalizeAudience, toLocalInput } from "@/lib/notifications/model";
import { DEFAULT_TIMEZONE } from "@/lib/surveys/schedule";
import type { EditorValues } from "@/components/notifications/NotificationEditor";

/** Dados comuns das telas do módulo: projeto, fuso, plataformas, sino e permissão. */
export async function notificationsContext() {
  const [projectId, workspaceId, canEdit] = await Promise.all([getCurrentProjectId(), getCurrentWorkspaceId(), canEditContent()]);
  const [workspace, hosts, settings] = await Promise.all([getWorkspace(workspaceId), listHosts(projectId).catch(() => []), getBellSettings(projectId)]);
  return { projectId, workspaceId, canEdit, hosts, settings, tz: workspace?.timezone || DEFAULT_TIMEZONE };
}

/** Valores do editor para um recado existente (ou 404 se não for do projeto). */
export async function editorValues(id: string, projectId: string, tz: string): Promise<EditorValues> {
  const n = await getNotification(id, projectId);
  if (!n) notFound();
  const aud = normalizeAudience(n.audience);
  return {
    id: n.id,
    title: n.title,
    body: n.body,
    category: isCategory(n.category) ? n.category : "aviso",
    ctaLabel: n.ctaLabel ?? "",
    ctaUrl: n.ctaUrl ?? "",
    schoolYears: aud.schoolYears,
    list: aud.list,
    hosts: Array.isArray(n.hosts) ? (n.hosts as string[]) : [],
    pinned: n.pinned,
    publishAt: toLocalInput(n.publishAt, tz),
    expiresAt: toLocalInput(n.expiresAt, tz),
    status: n.status,
  };
}

/** Sugestão de fim para um recado novo: daqui a 7 dias, às 23:59. */
export function defaultExpires(tz: string): string {
  const d = toLocalInput(new Date(Date.now() + 7 * 86_400_000), tz);
  return `${d.slice(0, 10)}T23:59`;
}
