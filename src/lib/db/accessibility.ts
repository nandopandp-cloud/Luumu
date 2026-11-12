import "server-only";
import { and, asc, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "./client";
import { accessibilityInvitees, accessibilitySettings, accessibilityUserPrefs } from "@/lib/db/schema";
import { normalizeA11yConfig, publicA11yConfig, type A11yConfig, type PublicA11yConfig } from "@/lib/accessibility/config";
import { hostInScope } from "@/lib/accessibility/scope";
import { normalizePrefs, type A11yPrefs } from "@/lib/accessibility/features";
import { isInviteeStatus, type InviteeInput, type InviteeStatus } from "@/lib/accessibility/invitees";
import { newIdentitySecret, prefsKey } from "@/lib/accessibility/verify";

/*
  Plugin de Acessibilidade no banco (ver schema.ts):
   - accessibility_settings: configuração, segredo de verificação;
   - accessibility_invitees: convidados (lista individual, dado sensível);
   - accessibility_user_prefs: escolhas de cada estudante, em qualquer aparelho.

  O /config consulta em TODA carga do SDK, por isso o cache de 60s por instância (mesma regra
  dos heatmaps): mudanças levam até 1 minuto para chegar aos sites — o mesmo atraso do cache de
  borda do /config.
*/

export interface AccessibilitySettings {
  enabled: boolean;
  config: A11yConfig;
  requireVerified: boolean;
  hasSecret: boolean;
  /** quantos convidados há na lista */
  invitees: number;
  updatedAt: Date | null;
}

const cache = new Map<string, { v: AccessibilitySettings & { secret: string | null }; exp: number }>();
const TTL_MS = 60_000;

async function load(projectId: string) {
  const hit = cache.get(projectId);
  if (hit && hit.exp > Date.now()) return hit.v;
  const [[row], [{ n } = { n: 0 }]] = await Promise.all([
    db.select().from(accessibilitySettings).where(eq(accessibilitySettings.projectId, projectId)).limit(1),
    db.select({ n: count() }).from(accessibilityInvitees).where(eq(accessibilityInvitees.projectId, projectId)),
  ]);
  const v = {
    enabled: !!row?.enabled,
    config: normalizeA11yConfig(row?.config ?? {}),
    requireVerified: !!row?.requireVerified,
    hasSecret: !!row?.identitySecret,
    updatedAt: row?.updatedAt ?? null,
    secret: row?.identitySecret ?? null,
    invitees: Number(n),
  };
  cache.set(projectId, { v, exp: Date.now() + TTL_MS });
  return v;
}

/** Configuração para o painel (sem o segredo). Sem linha = desligado com o padrão. */
export async function getAccessibilitySettings(projectId: string): Promise<AccessibilitySettings> {
  const { secret: _s, ...rest } = await load(projectId);
  void _s;
  return rest;
}

/**
 * O que vai no /config: o recorte público, ou null quando o plugin está desligado ou não vale
 * para esta plataforma (escopo por domínio).
 */
export async function getAccessibilityForSdk(projectId: string, host: string | null): Promise<PublicA11yConfig | null> {
  const s = await load(projectId);
  if (!s.enabled || !hostInScope(s.config.scope, host)) return null;
  return publicA11yConfig(s.config, s.invitees > 0);
}

/** Para as rotas do SDK: configuração + segredo de verificação. */
export async function getAccessibilityAuth(projectId: string) {
  const s = await load(projectId);
  return { enabled: s.enabled, config: s.config, secret: s.secret, requireVerified: s.requireVerified };
}

export async function saveAccessibilitySettings(projectId: string, input: { enabled: boolean; config: unknown }, userId: string) {
  const config = normalizeA11yConfig(input.config);
  await db
    .insert(accessibilitySettings)
    .values({ projectId, enabled: input.enabled, config, updatedBy: userId })
    .onConflictDoUpdate({
      target: accessibilitySettings.projectId,
      set: { enabled: input.enabled, config, updatedBy: userId, updatedAt: new Date() },
    });
  cache.delete(projectId);
  return config;
}

/* ---------- verificação de identidade ---------- */

/** Segredo do projeto (cria na primeira vez). Só o painel, para owner/admin. */
export async function getOrCreateIdentitySecret(projectId: string, userId: string, rotate = false): Promise<string> {
  const [row] = await db.select({ secret: accessibilitySettings.identitySecret }).from(accessibilitySettings).where(eq(accessibilitySettings.projectId, projectId)).limit(1);
  if (row?.secret && !rotate) return row.secret;
  const secret = newIdentitySecret();
  await db
    .insert(accessibilitySettings)
    .values({ projectId, identitySecret: secret, updatedBy: userId })
    .onConflictDoUpdate({ target: accessibilitySettings.projectId, set: { identitySecret: secret, updatedBy: userId, updatedAt: new Date() } });
  cache.delete(projectId);
  return secret;
}

export async function setRequireVerified(projectId: string, on: boolean, userId: string) {
  await db
    .insert(accessibilitySettings)
    .values({ projectId, requireVerified: on, updatedBy: userId })
    .onConflictDoUpdate({ target: accessibilitySettings.projectId, set: { requireVerified: on, updatedBy: userId, updatedAt: new Date() } });
  cache.delete(projectId);
}

/* ---------- convidados ---------- */

export interface InviteeRow {
  key: string;
  name: string;
  profile: string | null;
  status: InviteeStatus;
  lastEventAt: string | null;
  createdAt: string;
}

export async function listInvitees(projectId: string, opts: { q?: string; status?: InviteeStatus | null; page?: number; pageSize?: number }) {
  const pageSize = Math.min(100, Math.max(10, opts.pageSize ?? 50));
  const page = Math.max(0, opts.page ?? 0);
  const q = opts.q?.trim();
  const where = and(
    eq(accessibilityInvitees.projectId, projectId),
    q ? or(ilike(accessibilityInvitees.userKey, `%${q.toLowerCase()}%`), ilike(accessibilityInvitees.name, `%${q}%`)) : undefined,
    opts.status ? eq(accessibilityInvitees.status, opts.status) : undefined
  );
  const [rows, [{ n } = { n: 0 }], byStatus] = await Promise.all([
    db.select().from(accessibilityInvitees).where(where).orderBy(desc(accessibilityInvitees.createdAt), asc(accessibilityInvitees.userKey)).limit(pageSize).offset(page * pageSize),
    db.select({ n: count() }).from(accessibilityInvitees).where(where),
    db.select({ status: accessibilityInvitees.status, n: count() }).from(accessibilityInvitees).where(eq(accessibilityInvitees.projectId, projectId)).groupBy(accessibilityInvitees.status),
  ]);
  const totals = { pending: 0, shown: 0, accepted: 0, dismissed: 0 } as Record<InviteeStatus, number>;
  for (const r of byStatus) if (isInviteeStatus(r.status)) totals[r.status] = Number(r.n);
  return {
    rows: rows.map(
      (r): InviteeRow => ({
        key: r.userKey,
        name: r.name,
        profile: r.profile,
        status: isInviteeStatus(r.status) ? r.status : "pending",
        lastEventAt: r.lastEventAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })
    ),
    total: Number(n),
    totals,
    page,
    pageSize,
  };
}

/** Adiciona ou atualiza (nome/perfil) em lotes. Quem já estava mantém o status do convite. */
export async function upsertInvitees(projectId: string, rows: InviteeInput[], userId: string): Promise<{ added: number; updated: number }> {
  let added = 0;
  let updated = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const existing = await db
      .select({ k: accessibilityInvitees.userKey })
      .from(accessibilityInvitees)
      .where(and(eq(accessibilityInvitees.projectId, projectId), inArray(accessibilityInvitees.userKey, chunk.map((r) => r.key))));
    updated += existing.length;
    added += chunk.length - existing.length;
    await db
      .insert(accessibilityInvitees)
      .values(chunk.map((r) => ({ projectId, userKey: r.key, name: r.name, profile: r.profile, createdBy: userId })))
      .onConflictDoUpdate({
        target: [accessibilityInvitees.projectId, accessibilityInvitees.userKey],
        // nome/perfil vazios na importação não apagam o que já existia
        set: {
          name: sql`case when excluded.name <> '' then excluded.name else ${accessibilityInvitees.name} end`,
          profile: sql`coalesce(excluded.profile, ${accessibilityInvitees.profile})`,
        },
      });
  }
  cache.delete(projectId);
  return { added, updated };
}

export async function removeInvitees(projectId: string, keys: string[] | "all") {
  if (keys === "all") await db.delete(accessibilityInvitees).where(eq(accessibilityInvitees.projectId, projectId));
  else if (keys.length) await db.delete(accessibilityInvitees).where(and(eq(accessibilityInvitees.projectId, projectId), inArray(accessibilityInvitees.userKey, keys)));
  cache.delete(projectId);
}

/** O estudante (por ID ou e-mail) está na lista? Devolve o perfil sugerido dele. */
export async function findInvitee(projectId: string, keys: string[]) {
  if (!keys.length) return null;
  const [row] = await db
    .select({ key: accessibilityInvitees.userKey, profile: accessibilityInvitees.profile, status: accessibilityInvitees.status })
    .from(accessibilityInvitees)
    .where(and(eq(accessibilityInvitees.projectId, projectId), inArray(accessibilityInvitees.userKey, keys)))
    .limit(1);
  return row ?? null;
}

/** Desfecho do convite. "accepted" não volta atrás; "shown" não sobrescreve um desfecho. */
export async function recordInviteeEvent(projectId: string, key: string, status: Exclude<InviteeStatus, "pending">) {
  const from: InviteeStatus[] = status === "shown" ? ["pending"] : ["pending", "shown", "dismissed"];
  await db
    .update(accessibilityInvitees)
    .set({ status, lastEventAt: new Date() })
    .where(and(eq(accessibilityInvitees.projectId, projectId), eq(accessibilityInvitees.userKey, key), inArray(accessibilityInvitees.status, from)));
}

/* ---------- preferências por estudante ---------- */

export async function getUserPrefs(projectId: string, userKey: string): Promise<{ prefs: A11yPrefs; t: number } | null> {
  const [row] = await db
    .select({ prefs: accessibilityUserPrefs.prefs, updatedAt: accessibilityUserPrefs.updatedAt })
    .from(accessibilityUserPrefs)
    .where(and(eq(accessibilityUserPrefs.projectId, projectId), eq(accessibilityUserPrefs.userHash, prefsKey(projectId, userKey))))
    .limit(1);
  return row ? { prefs: normalizePrefs(row.prefs), t: row.updatedAt.getTime() } : null;
}

/**
 * Grava as escolhas. `t` é quando o estudante mudou (relógio do navegador, limitado ao do
 * servidor): uma gravação mais velha que a guardada é ignorada — dois aparelhos abertos não
 * se sobrescrevem com estado antigo.
 */
export async function saveUserPrefs(projectId: string, userKey: string, prefs: unknown, t: number): Promise<number> {
  const at = new Date(Math.min(Date.now(), Math.max(0, t)));
  const userHash = prefsKey(projectId, userKey);
  await db
    .insert(accessibilityUserPrefs)
    .values({ projectId, userHash, prefs: normalizePrefs(prefs), updatedAt: at })
    .onConflictDoUpdate({
      target: [accessibilityUserPrefs.projectId, accessibilityUserPrefs.userHash],
      set: { prefs: sql`excluded.prefs`, updatedAt: sql`excluded.updated_at` },
      setWhere: sql`${accessibilityUserPrefs.updatedAt} <= excluded.updated_at`,
    });
  return at.getTime();
}
