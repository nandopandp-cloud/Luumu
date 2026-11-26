import "server-only";
import { randomBytes } from "node:crypto";
import { and, count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "./client";
import { notificationActivities, notificationActivityStats, notificationWebhookDeliveries, notificationWebhooks } from "@/lib/db/schema";
import { newWebhookSecret } from "@/lib/notifications/signature";
import { toFeed, type ActivityItemKind, type FeedActivity } from "@/lib/notifications/activities";
import type { EventOutcome, ParsedEvent } from "@/lib/notifications/webhook";
import type { NotificationEventKind } from "@/lib/notifications/model";

/*
  Avisos automáticos de atividades: segredo do webhook, atividades recebidas, registro dos envios,
  feed por turma e métricas. Regras puras em lib/notifications/activities.ts e webhook.ts.
  Sem a migração 0051 as funções lançam erro; quem chama trata como "indisponível".
*/

const PREVIOUS_GRACE_MS = 24 * 3600_000;

/* ---------- segredo ---------- */

/** Segredos aceitos agora (o atual e, por 24h depois de uma troca, o anterior). [] = nenhum gerado. */
export async function webhookSecrets(projectId: string): Promise<string[]> {
  const [row] = await db.select().from(notificationWebhooks).where(eq(notificationWebhooks.projectId, projectId)).limit(1);
  if (!row) return [];
  const out = [row.secret];
  if (row.previousSecret && row.previousUntil && row.previousUntil.getTime() > Date.now()) out.push(row.previousSecret);
  return out;
}

export interface WebhookSecretInfo {
  hasSecret: boolean;
  updatedAt: Date | null;
  /** o segredo anterior ainda vale até… (troca recente) */
  previousUntil: Date | null;
}

/** null = tabela ainda não existe (migração 0051). */
export async function webhookSecretInfo(projectId: string): Promise<WebhookSecretInfo | null> {
  try {
    const [row] = await db.select().from(notificationWebhooks).where(eq(notificationWebhooks.projectId, projectId)).limit(1);
    if (!row) return { hasSecret: false, updatedAt: null, previousUntil: null };
    const prev = row.previousUntil && row.previousUntil.getTime() > Date.now() ? row.previousUntil : null;
    return { hasSecret: true, updatedAt: row.updatedAt, previousUntil: prev };
  } catch {
    return null;
  }
}

/** Mostra o segredo (gera na primeira vez). `rotate`: gera outro e mantém o atual aceito por 24h. */
export async function revealWebhookSecret(workspaceId: string, projectId: string, userId: string, rotate = false): Promise<string> {
  const [row] = await db.select().from(notificationWebhooks).where(eq(notificationWebhooks.projectId, projectId)).limit(1);
  if (row && !rotate) return row.secret;
  const secret = newWebhookSecret();
  if (row) {
    await db
      .update(notificationWebhooks)
      .set({ secret, previousSecret: row.secret, previousUntil: new Date(Date.now() + PREVIOUS_GRACE_MS), updatedBy: userId, updatedAt: new Date() })
      .where(eq(notificationWebhooks.projectId, projectId));
  } else {
    await db.insert(notificationWebhooks).values({ projectId, workspaceId, secret, updatedBy: userId }).onConflictDoNothing();
    // duas abas gerando ao mesmo tempo: vale o que ficou gravado
    const [saved] = await db.select({ secret: notificationWebhooks.secret }).from(notificationWebhooks).where(eq(notificationWebhooks.projectId, projectId)).limit(1);
    return saved?.secret ?? secret;
  }
  return secret;
}

/* ---------- eventos do webhook ---------- */

type ValidEvent = Extract<ParsedEvent, { ok: true }>;

/**
 * Aplica um evento válido. Idempotente: o mesmo `id` de evento de novo responde "duplicate" sem
 * mexer em nada, e um evento com `occurredAt` mais antigo que o último aplicado responde "stale".
 * A atividade é gravada antes do registro: se algo falhar no meio, o reenvio do cliente refaz
 * (gravar a mesma fotografia duas vezes dá no mesmo).
 */
export async function applyActivityEvent(workspaceId: string, projectId: string, ev: ValidEvent): Promise<EventOutcome> {
  const [dup] = await db
    .select({ id: notificationWebhookDeliveries.eventId })
    .from(notificationWebhookDeliveries)
    .where(and(eq(notificationWebhookDeliveries.projectId, projectId), eq(notificationWebhookDeliveries.eventId, ev.id)))
    .limit(1);
  if (dup) return "duplicate";

  const t = notificationActivities;
  const newer = sql`${t.occurredAt} <= excluded.occurred_at`;
  let rows: { id: string }[];
  if (ev.event === "activity.canceled") {
    // cancelamento de uma atividade que a Luumu não conhecia: fica a marca, para um "assigned"
    // atrasado (mais antigo) não ressuscitar a atividade
    rows = await db
      .insert(t)
      .values({ projectId, workspaceId, externalId: ev.activity.id, type: "tarefa", assignedAt: ev.occurredAt, status: "canceled", occurredAt: ev.occurredAt })
      .onConflictDoUpdate({
        target: [t.projectId, t.externalId],
        set: { status: "canceled", occurredAt: sql`excluded.occurred_at`, updatedAt: new Date() },
        setWhere: newer,
      })
      .returning({ id: t.externalId });
  } else {
    const a = ev.activity;
    rows = await db
      .insert(t)
      .values({
        projectId,
        workspaceId,
        externalId: a.id,
        type: a.type,
        title: a.title,
        subject: a.subject,
        url: a.url,
        assignedAt: a.assignedAt,
        dueAt: a.dueAt,
        classIds: a.classIds,
        status: "active",
        occurredAt: ev.occurredAt,
      })
      .onConflictDoUpdate({
        target: [t.projectId, t.externalId],
        set: {
          type: sql`excluded.type`,
          title: sql`excluded.title`,
          subject: sql`excluded.subject`,
          url: sql`excluded.url`,
          assignedAt: sql`excluded.assigned_at`,
          dueAt: sql`excluded.due_at`,
          classIds: sql`excluded.class_ids`,
          status: "active",
          occurredAt: sql`excluded.occurred_at`,
          updatedAt: new Date(),
        },
        setWhere: newer,
      })
      .returning({ id: t.externalId });
  }
  const outcome: EventOutcome = rows.length ? "applied" : "stale";
  await db
    .insert(notificationWebhookDeliveries)
    .values({ projectId, eventId: ev.id, event: ev.event, activityId: ev.activity.id, status: outcome })
    .onConflictDoNothing();
  return outcome;
}

/**
 * Registra uma recusa (evento inválido, assinatura errada) para aparecer no painel. A chave é
 * gerada aqui, e não o `id` do cliente: assim o mesmo evento, corrigido, não é tomado por repetido.
 */
export async function logRejectedDelivery(
  projectId: string,
  r: { status: "invalid" | "unauthorized"; event?: string | null; eventId?: string | null; activityId?: string | null; error: string }
) {
  const error = (r.eventId ? `[${r.eventId}] ${r.error}` : r.error).slice(0, 500);
  await db
    .insert(notificationWebhookDeliveries)
    .values({ projectId, eventId: `!${randomBytes(9).toString("base64url")}`, event: (r.event ?? "").slice(0, 40), activityId: r.activityId?.slice(0, 100) ?? null, status: r.status, error })
    .onConflictDoNothing();
}

/* ---------- feed da turma (SDK) ---------- */

/**
 * Atividades em aberto da turma: liberadas (ou liberadas na próxima hora, que o sino mostra na hora
 * certa), sem prazo vencido; sem prazo, até 30 dias depois da liberação. Prazo mais próximo primeiro.
 */
export async function feedForClass(projectId: string, classId: string): Promise<FeedActivity[]> {
  const t = notificationActivities;
  const rows = await db
    .select({ externalId: t.externalId, type: t.type, title: t.title, subject: t.subject, url: t.url, assignedAt: t.assignedAt, dueAt: t.dueAt })
    .from(t)
    .where(
      and(
        eq(t.projectId, projectId),
        eq(t.status, "active"),
        sql`${t.classIds} @> array[${classId}]::text[]`,
        sql`${t.assignedAt} <= now() + interval '1 hour'`,
        sql`(${t.dueAt} > now() or (${t.dueAt} is null and ${t.assignedAt} > now() - interval '30 days'))`
      )
    )
    .orderBy(sql`${t.dueAt} asc nulls last`, desc(t.assignedAt))
    .limit(100);
  return toFeed(rows);
}

/* ---------- métricas ---------- */

const statDay = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

/** Soma as métricas do sino (cada (aviso, tipo) já vem uma vez por estudante). Ignora ids de fora do projeto. */
export async function recordActivityStats(projectId: string, entries: { activityId: string; item: ActivityItemKind; kind: NotificationEventKind }[]) {
  if (!entries.length) return 0;
  const ids = [...new Set(entries.map((e) => e.activityId))];
  const own = await db
    .select({ id: notificationActivities.externalId })
    .from(notificationActivities)
    .where(and(eq(notificationActivities.projectId, projectId), inArray(notificationActivities.externalId, ids)));
  const ok = new Set(own.map((r) => r.id));
  const sums = new Map<string, { activityId: string; item: string; kind: string; n: number }>();
  for (const e of entries) {
    if (!ok.has(e.activityId)) continue;
    const k = `${e.activityId}\u0000${e.item}\u0000${e.kind}`;
    const cur = sums.get(k) ?? { activityId: e.activityId, item: e.item, kind: e.kind, n: 0 };
    cur.n += 1;
    sums.set(k, cur);
  }
  if (!sums.size) return 0;
  const day = statDay();
  const s = notificationActivityStats;
  await db
    .insert(s)
    .values([...sums.values()].map((v) => ({ projectId, ...v, day })))
    .onConflictDoUpdate({ target: [s.projectId, s.activityId, s.item, s.kind, s.day], set: { n: sql`${s.n} + excluded.n` } });
  return sums.size;
}

/* ---------- painel ---------- */

export interface ActivityStats {
  delivered: number;
  seen: number;
  click: number;
}

export interface PanelActivity {
  id: string;
  type: string;
  title: string;
  subject: string | null;
  url: string;
  assignedAt: Date;
  dueAt: Date | null;
  classIds: string[];
  status: string;
  /** aberta = ainda no sino; encerrada = prazo passou; cancelada = activity.canceled */
  state: "aberta" | "encerrada" | "cancelada";
  updatedAt: Date;
  stats: Record<ActivityItemKind, ActivityStats>;
}

export interface PanelDelivery {
  eventId: string;
  event: string;
  activityId: string | null;
  status: string;
  error: string | null;
  receivedAt: Date;
}

export interface IntegrationOverview {
  activities: PanelActivity[];
  open: number;
  total: number;
  deliveries: PanelDelivery[];
  last24h: Record<string, number>;
  lastReceivedAt: Date | null;
}

const zero = (): ActivityStats => ({ delivered: 0, seen: 0, click: 0 });

/** Visão do painel: últimas atividades com métricas, últimos envios e o resumo de 24h. null = sem a migração 0051. */
export async function integrationOverview(projectId: string): Promise<IntegrationOverview | null> {
  try {
    const t = notificationActivities;
    const d = notificationWebhookDeliveries;
    const since = new Date(Date.now() - 24 * 3600_000);
    const [rows, totals, deliveries, recent] = await Promise.all([
      db.select().from(t).where(eq(t.projectId, projectId)).orderBy(desc(t.updatedAt)).limit(50),
      db
        .select({
          total: count(),
          open: sql<number>`count(*) filter (where ${t.status} = 'active' and (${t.dueAt} is null or ${t.dueAt} > now()))`,
        })
        .from(t)
        .where(eq(t.projectId, projectId)),
      db.select().from(d).where(eq(d.projectId, projectId)).orderBy(desc(d.receivedAt)).limit(30),
      db.select({ status: d.status, n: count() }).from(d).where(and(eq(d.projectId, projectId), gte(d.receivedAt, since))).groupBy(d.status),
    ]);
    const stats = new Map<string, Record<ActivityItemKind, ActivityStats>>();
    if (rows.length) {
      const s = notificationActivityStats;
      const sums = await db
        .select({ id: s.activityId, item: s.item, kind: s.kind, n: sql<number>`sum(${s.n})::int` })
        .from(s)
        .where(and(eq(s.projectId, projectId), inArray(s.activityId, rows.map((r) => r.externalId))))
        .groupBy(s.activityId, s.item, s.kind);
      for (const x of sums) {
        const cur = stats.get(x.id) ?? { nova: zero(), prazo: zero() };
        if ((x.item === "nova" || x.item === "prazo") && (x.kind === "delivered" || x.kind === "seen" || x.kind === "click")) cur[x.item][x.kind] = Number(x.n);
        stats.set(x.id, cur);
      }
    }
    const now = Date.now();
    return {
      activities: rows.map((r) => ({
        id: r.externalId,
        type: r.type,
        title: r.title,
        subject: r.subject,
        url: r.url,
        assignedAt: r.assignedAt,
        dueAt: r.dueAt,
        classIds: r.classIds,
        status: r.status,
        state: r.status === "canceled" ? "cancelada" : r.dueAt && r.dueAt.getTime() <= now ? "encerrada" : "aberta",
        updatedAt: r.updatedAt,
        stats: stats.get(r.externalId) ?? { nova: zero(), prazo: zero() },
      })),
      open: Number(totals[0]?.open ?? 0),
      total: Number(totals[0]?.total ?? 0),
      deliveries: deliveries.map((x) => ({ eventId: x.eventId, event: x.event, activityId: x.activityId, status: x.status, error: x.error, receivedAt: x.receivedAt })),
      last24h: Object.fromEntries(recent.map((r) => [r.status, Number(r.n)])),
      lastReceivedAt: deliveries[0]?.receivedAt ?? null,
    };
  } catch {
    return null;
  }
}

/* ---------- retenção (cron diário) ---------- */

/** Atividades encerradas há mais de 30 dias (com as métricas) e envios com mais de 30 dias. */
export async function pruneActivities(): Promise<{ activities: number; deliveries: number }> {
  const a = (await db.execute(sql`
    delete from notification_activities
     where (status = 'canceled' and updated_at < now() - interval '30 days')
        or due_at < now() - interval '30 days'
        or (due_at is null and assigned_at < now() - interval '60 days')`)) as unknown as { rowCount?: number };
  const d = (await db.execute(sql`delete from notification_webhook_deliveries where received_at < now() - interval '30 days'`)) as unknown as { rowCount?: number };
  return { activities: a.rowCount ?? 0, deliveries: d.rowCount ?? 0 };
}
