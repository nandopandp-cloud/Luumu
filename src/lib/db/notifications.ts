import "server-only";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "./client";
import { notificationEvents, notifications, notificationSettings } from "@/lib/db/schema";
import { notificationId } from "./ids";
import {
  DEFAULT_BELL_SETTINGS,
  EVENT_KINDS,
  normalizeAudience,
  normalizeBellSettings,
  publicNotifications,
  type BellSettings,
  type NotificationDraft,
  type NotificationEventKind,
  type NotificationStatus,
  type PublicNotifications,
} from "@/lib/notifications/model";

/*
  Notificações no produto do cliente (regras em lib/notifications/model.ts). Tudo por projeto;
  quem chama já resolveu o projeto da sessão (painel) ou da SDK key (API).
  Sem a migração 0048 as leituras do painel devolvem null ("módulo indisponível") e o /config
  segue sem sino.
*/

export type NotificationRow = typeof notifications.$inferSelect;

/** Configuração do sino; null = tabelas ainda não existem (migração 0048). */
export async function getBellSettings(projectId: string): Promise<BellSettings | null> {
  try {
    const [row] = await db.select().from(notificationSettings).where(eq(notificationSettings.projectId, projectId)).limit(1);
    return row ? normalizeBellSettings(row.settings) : { ...DEFAULT_BELL_SETTINGS };
  } catch {
    return null;
  }
}

export async function saveBellSettings(workspaceId: string, projectId: string, settings: BellSettings, userId: string) {
  const value = normalizeBellSettings(settings);
  await db
    .insert(notificationSettings)
    .values({ projectId, workspaceId, settings: value, updatedBy: userId })
    .onConflictDoUpdate({ target: notificationSettings.projectId, set: { settings: value, updatedBy: userId, updatedAt: new Date() } });
  return value;
}

export interface NotificationStats {
  delivered: number;
  seen: number;
  click: number;
}

/** Recados do projeto (mais novos primeiro) com as métricas de cada um. */
export async function listNotifications(projectId: string): Promise<(NotificationRow & { stats: NotificationStats })[]> {
  const rows = await db.select().from(notifications).where(eq(notifications.projectId, projectId)).orderBy(desc(notifications.createdAt));
  if (!rows.length) return [];
  const counts = await db
    .select({ id: notificationEvents.notificationId, kind: notificationEvents.kind, n: count() })
    .from(notificationEvents)
    .where(inArray(notificationEvents.notificationId, rows.map((r) => r.id)))
    .groupBy(notificationEvents.notificationId, notificationEvents.kind);
  const stats = new Map<string, NotificationStats>();
  for (const c of counts) {
    const s = stats.get(c.id) ?? { delivered: 0, seen: 0, click: 0 };
    if (c.kind === "delivered" || c.kind === "seen" || c.kind === "click") s[c.kind] = Number(c.n);
    stats.set(c.id, s);
  }
  return rows.map((r) => ({ ...r, stats: stats.get(r.id) ?? { delivered: 0, seen: 0, click: 0 } }));
}

export async function getNotification(id: string, projectId: string): Promise<NotificationRow | null> {
  const [row] = await db.select().from(notifications).where(and(eq(notifications.id, id), eq(notifications.projectId, projectId))).limit(1);
  return row ?? null;
}

const draftColumns = (d: NotificationDraft) => ({
  title: d.title.trim(),
  body: d.body.trim(),
  category: d.category,
  ctaLabel: d.ctaLabel.trim() || null,
  ctaUrl: d.ctaUrl.trim() || null,
  audience: normalizeAudience(d.audience),
  hosts: d.hosts,
  pinned: d.pinned,
  publishAt: d.publishAt,
  expiresAt: d.expiresAt,
});

/** Cria ou atualiza o recado e define o status ("publicada" grava a data da 1ª publicação). */
export async function saveNotification(input: {
  id?: string;
  workspaceId: string;
  projectId: string;
  draft: NotificationDraft;
  status: NotificationStatus;
  userId: string;
}): Promise<string> {
  const now = new Date();
  const cols = { ...draftColumns(input.draft), status: input.status, updatedAt: now };
  if (input.id) {
    const current = await getNotification(input.id, input.projectId);
    if (!current) throw new Error("Notificação não encontrada neste projeto.");
    await db
      .update(notifications)
      .set({ ...cols, publishedAt: input.status === "publicada" ? (current.publishedAt ?? now) : current.publishedAt })
      .where(and(eq(notifications.id, input.id), eq(notifications.projectId, input.projectId)));
    return input.id;
  }
  const id = notificationId();
  await db.insert(notifications).values({
    id,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    ...cols,
    publishedAt: input.status === "publicada" ? now : null,
    createdBy: input.userId,
  });
  return id;
}

export async function setNotificationStatus(id: string, projectId: string, status: NotificationStatus) {
  const r = await db
    .update(notifications)
    .set({ status, updatedAt: new Date(), ...(status === "publicada" ? { publishedAt: sql`coalesce(${notifications.publishedAt}, now())` } : {}) })
    .where(and(eq(notifications.id, id), eq(notifications.projectId, projectId)))
    .returning({ id: notifications.id });
  return r.length > 0;
}

export async function deleteNotification(id: string, projectId: string) {
  await db.delete(notifications).where(and(eq(notifications.id, id), eq(notifications.projectId, projectId)));
}

/** Cópia como rascunho (sem métricas nem datas). */
export async function duplicateNotification(id: string, projectId: string, userId: string): Promise<string | null> {
  const src = await getNotification(id, projectId);
  if (!src) return null;
  const copy = notificationId();
  await db.insert(notifications).values({
    id: copy,
    workspaceId: src.workspaceId,
    projectId: src.projectId,
    kind: src.kind,
    category: src.category,
    title: `${src.title} (cópia)`.slice(0, 80),
    body: src.body,
    ctaLabel: src.ctaLabel,
    ctaUrl: src.ctaUrl,
    audience: src.audience as object,
    hosts: src.hosts as object,
    pinned: src.pinned,
    status: "rascunho",
    createdBy: userId,
  });
  return copy;
}

/* ---------- SDK ---------- */

/** Recorte público do sino para o /config; null = desligado, fora desta plataforma ou sem a migração. */
export async function notificationsForSdk(projectId: string, host: string | null): Promise<PublicNotifications | null> {
  const settings = await getBellSettings(projectId);
  if (!settings?.enabled) return null;
  const rows = await db
    .select({
      id: notifications.id,
      title: notifications.title,
      body: notifications.body,
      category: notifications.category,
      ctaLabel: notifications.ctaLabel,
      ctaUrl: notifications.ctaUrl,
      audience: notifications.audience,
      hosts: notifications.hosts,
      pinned: notifications.pinned,
      status: notifications.status,
      publishAt: notifications.publishAt,
      publishedAt: notifications.publishedAt,
      expiresAt: notifications.expiresAt,
    })
    .from(notifications)
    .where(
      and(
        eq(notifications.projectId, projectId),
        inArray(notifications.status, ["publicada", "teste"]),
        sql`(${notifications.expiresAt} is null or ${notifications.expiresAt} > now())`
      )
    )
    .orderBy(desc(notifications.createdAt))
    .limit(100);
  return publicNotifications(settings, rows, projectId, host);
}

/** Grava eventos do SDK (uma linha por recado/usuário/tipo). Ignora ids de outro projeto. */
export async function recordNotificationEvents(projectId: string, userKey: string, events: { id: string; kind: NotificationEventKind }[]) {
  const valid = events.filter((e) => EVENT_KINDS.includes(e.kind));
  if (!valid.length) return 0;
  const ids = [...new Set(valid.map((e) => e.id))];
  const own = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.projectId, projectId), inArray(notifications.id, ids)));
  const ok = new Set(own.map((r) => r.id));
  const rows = valid.filter((e) => ok.has(e.id)).map((e) => ({ notificationId: e.id, userKey, kind: e.kind }));
  if (!rows.length) return 0;
  await db.insert(notificationEvents).values(rows).onConflictDoNothing();
  return rows.length;
}

/** Retenção: recados encerrados há mais de 90 dias saem com as métricas (cron diário). */
export async function pruneNotifications(): Promise<number> {
  const r = (await db.execute(sql`
    delete from notifications
     where status <> 'rascunho'
       and coalesce(expires_at, published_at, updated_at) < now() - interval '90 days'
       and (status = 'arquivada' or expires_at is not null)`)) as unknown as { rowCount?: number };
  return r.rowCount ?? 0;
}
