import "server-only";
import { and, asc, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "./client";
import { accessibilityInvitees, accessibilitySettings, accessibilityUserPrefs } from "@/lib/db/schema";
import { normalizeA11yConfig, publicA11yConfig, type A11yConfig, type PublicA11yConfig } from "@/lib/accessibility/config";
import { hostInScope } from "@/lib/accessibility/scope";
import { normalizePrefs, type A11yPrefs } from "@/lib/accessibility/features";
import { isInviteeStatus, type InviteeInput, type InviteeStatus } from "@/lib/accessibility/invitees";
import { parseNudgeMemo, type NudgeMemo } from "@/lib/accessibility/nudge";
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

/** O projeto configurou o plugin (ligado ou não): o SDK guarda o catálogo por menos tempo. */
export async function accessibilityConfigured(projectId: string): Promise<boolean> {
  const s = await load(projectId);
  return s.updatedAt !== null;
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

/*
  Preferências de cada estudante, na conta (accessibility_user_prefs).

  Regra: a conta guarda SEMPRE a última mudança que chegou ao servidor — com a hora do
  servidor, não a do aparelho (relógio de celular/computador adiantado ou atrasado decidia
  quem vencia e fazia a mudança mais nova ser recusada em silêncio). Quem decide se um
  aparelho sobrescreve a conta é o próprio aparelho: só quando tem mudança ainda não enviada
  (sdk/accessibility/widget.ts).

  Chaves: o mesmo estudante pode chegar com ID e e-mail num aparelho e só com o e-mail em
  outro. A conta é gravada em todas as chaves que vierem (ID e e-mail) e lida por qualquer
  uma — vale a linha mais recente. Com "exigir verificação", só a chave assinada é usada.

  O desfecho do convite (visto/aceito/dispensado) fica na mesma linha, na chave `_nudge` do
  JSON: "aceito" nunca volta atrás; entre os outros, vale o mais recente.
*/
/** Desfecho do convite que vale entre dois: "aceito" vence; senão o mais recente. */
export function mergeNudge(a: NudgeMemo | null, b: NudgeMemo | null): NudgeMemo | null {
  if (!a || !b) return a ?? b;
  if (a.s === "accepted" || b.s === "accepted") return a.s === "accepted" && (b.s !== "accepted" || a.at <= b.at) ? a : b;
  return a.at >= b.at ? a : b;
}

export async function getUserPrefs(projectId: string, userKeys: string[]): Promise<{ prefs: A11yPrefs | null; t: number; nudge: NudgeMemo | null } | null> {
  const hashes = [...new Set(userKeys.filter(Boolean))].map((k) => prefsKey(projectId, k));
  if (!hashes.length) return null;
  const rows = await db
    .select({ prefs: accessibilityUserPrefs.prefs, updatedAt: accessibilityUserPrefs.updatedAt })
    .from(accessibilityUserPrefs)
    .where(and(eq(accessibilityUserPrefs.projectId, projectId), inArray(accessibilityUserPrefs.userHash, hashes)))
    .orderBy(desc(accessibilityUserPrefs.updatedAt));
  if (!rows.length) return null;
  const newest = rows[0];
  const raw = (newest.prefs ?? {}) as Record<string, unknown>;
  // só o desfecho do convite é somado entre as chaves (aceitar em qualquer uma vale)
  const nudge = rows.reduce<NudgeMemo | null>((m, r) => mergeNudge(m, parseNudgeMemo(((r.prefs ?? {}) as Record<string, unknown>)._nudge)), null);
  // linha só com o desfecho do convite (sem escolhas) não sobrescreve nada no aparelho
  const hasPrefs = Object.keys(raw).some((k) => k !== "_nudge");
  return { prefs: hasPrefs ? normalizePrefs(raw) : null, t: newest.updatedAt.getTime(), nudge };
}

/**
 * Grava as escolhas (e o desfecho do convite, quando vier) em todas as chaves do estudante.
 * A hora é a do servidor: a última gravação que chega é a que vale. Sem `nudge`, o desfecho
 * já guardado é mantido; com ele, "aceito" nunca é rebaixado.
 */
export async function saveUserPrefs(projectId: string, userKeys: string[], prefs: unknown, nudge?: NudgeMemo | null): Promise<number> {
  const at = new Date();
  const memo = parseNudgeMemo(nudge);
  const base = normalizePrefs(prefs);
  for (const key of [...new Set(userKeys.filter(Boolean))]) {
    const userHash = prefsKey(projectId, key);
    const value = { ...base, ...(memo ? { _nudge: memo } : {}) };
    const keepNudge = sql`jsonb_strip_nulls(jsonb_build_object('_nudge', ${accessibilityUserPrefs.prefs} -> '_nudge'))`;
    await db
      .insert(accessibilityUserPrefs)
      .values({ projectId, userHash, prefs: value, updatedAt: at })
      .onConflictDoUpdate({
        target: [accessibilityUserPrefs.projectId, accessibilityUserPrefs.userHash],
        set: {
          // desfecho novo vale, exceto rebaixar um "aceito" já guardado; sem desfecho, mantém o guardado
          prefs: !memo
            ? sql`excluded.prefs || ${keepNudge}`
            : memo.s === "accepted"
              ? sql`excluded.prefs`
              : sql`excluded.prefs || case when ${accessibilityUserPrefs.prefs} -> '_nudge' ->> 's' = 'accepted' then ${keepNudge} else '{}'::jsonb end`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }
  return at.getTime();
}
