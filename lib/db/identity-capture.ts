import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { identityCaptureRules, identityCaptureSettings } from "@/db/schema";
import { isSafeSelector, stabilizeSelector } from "@/lib/analytics/selectors";

/*
  Captura de nome e foto do usuário a partir da tela do produto.
  - LIGAR/DESLIGAR: da workspace (identity_capture_settings.enabled).
  - ONDE PROCURAR: por projeto e plataforma (identity_capture_rules), porque cada produto tem
    seu HTML. Regra da plataforma > padrão do projeto (host '') > detecção automática.
*/

export interface IdentityCapture {
  enabled: boolean;
}

import type { CaptureMode, CaptureRule } from "@/lib/analytics/selectors";
export type { CaptureMode, CaptureRule };

const switchCache = new Map<string, { v: IdentityCapture; exp: number }>();

/** A captura está ligada na workspace? Sem linha (ou sem a migração 0023) = desligada. */
export async function getIdentityCapture(workspaceId: string, fresh = false): Promise<IdentityCapture> {
  const hit = switchCache.get(workspaceId);
  if (!fresh && hit && hit.exp > Date.now()) return hit.v;
  const [r] = await db.select({ enabled: identityCaptureSettings.enabled }).from(identityCaptureSettings).where(eq(identityCaptureSettings.workspaceId, workspaceId)).limit(1);
  const v = { enabled: !!r?.enabled };
  switchCache.set(workspaceId, { v, exp: Date.now() + 60_000 });
  return v;
}

export async function setIdentityCaptureEnabled(workspaceId: string, userId: string, enabled: boolean) {
  await db
    .insert(identityCaptureSettings)
    .values({ workspaceId, enabled, updatedBy: userId })
    .onConflictDoUpdate({ target: identityCaptureSettings.workspaceId, set: { enabled, updatedBy: userId, updatedAt: new Date() } });
  switchCache.delete(workspaceId);
}

/* ---------- regras por projeto/plataforma ---------- */

// consultado em todo GET /config (que já fica em cache na borda): 60 s por instância
const rulesCache = new Map<string, { v: CaptureRule[]; exp: number }>();

export async function listCaptureRules(projectId: string, fresh = false): Promise<CaptureRule[]> {
  const hit = rulesCache.get(projectId);
  if (!fresh && hit && hit.exp > Date.now()) return hit.v;
  const r = await db.select().from(identityCaptureRules).where(eq(identityCaptureRules.projectId, projectId));
  const v = r.map((x) => ({ host: x.host, mode: (x.mode === "selectors" ? "selectors" : "auto") as CaptureMode, nameSelector: x.nameSelector, avatarSelector: x.avatarSelector }));
  rulesCache.set(projectId, { v, exp: Date.now() + 60_000 });
  return v;
}

export { resolveCaptureRule } from "@/lib/analytics/selectors";

export async function saveCaptureRule(projectId: string, userId: string, rule: CaptureRule) {
  const v = { mode: rule.mode, nameSelector: rule.mode === "selectors" ? rule.nameSelector : "", avatarSelector: rule.mode === "selectors" ? rule.avatarSelector : "" };
  await db
    .insert(identityCaptureRules)
    .values({ projectId, host: rule.host, ...v, updatedBy: userId })
    .onConflictDoUpdate({ target: [identityCaptureRules.projectId, identityCaptureRules.host], set: { ...v, updatedBy: userId, updatedAt: new Date() } });
  rulesCache.delete(projectId);
}

/** Plataforma volta a seguir o padrão do projeto. */
export async function deleteCaptureRule(projectId: string, host: string) {
  await db.delete(identityCaptureRules).where(and(eq(identityCaptureRules.projectId, projectId), eq(identityCaptureRules.host, host)));
  rulesCache.delete(projectId);
}

/**
 * Seletor CSS que vai para o SDK no site do cliente: estabilizado (sem IDs gerados pelo React) e
 * sem nada que pareça código. "" = vazio ou recusado.
 */
export function cleanSelector(v: unknown): string {
  const { value } = stabilizeSelector(typeof v === "string" ? v : "");
  return isSafeSelector(value) ? value : "";
}

/* ---------- está funcionando? ---------- */

// só conta o que é DE UMA pessoa (mesma regra da lista em lib/db/analytics.ts)
const personal = (col: string) =>
  sql.raw(`u.${col} is not null and not exists (select 1 from analytics_users x where x.project_id = u.project_id and x.${col} = u.${col}
    and coalesce(x.user_id, x.user_email, x.anon_id) <> coalesce(u.user_id, u.user_email, u.anon_id))`);

export interface HostCoverage {
  host: string;
  /** usuários identificados ativos nas últimas 24 h nesta plataforma */
  identified: number;
  withName: number;
  withAvatar: number;
}

export interface CaptureStatus {
  /** do projeto, por plataforma (mais usadas primeiro) */
  hosts: HostCoverage[];
  /** projetos da workspace sem Analytics ativo: lá a captura não roda */
  withoutAnalytics: string[];
  /** o projeto atual tem Analytics ativo? */
  analyticsOn: boolean;
}

export async function identityCaptureStatus(workspaceId: string, projectId: string): Promise<CaptureStatus> {
  const rows = <T,>(r: unknown) => ((r as { rows?: T[] }).rows ?? (r as T[])) as T[];
  const [byHost, projects] = await Promise.all([
    db.execute(sql`
      select s.host,
             count(distinct u.anon_id)::int identified,
             count(distinct u.anon_id) filter (where ${personal("user_name")})::int with_name,
             count(distinct u.anon_id) filter (where u.user_avatar is not null)::int with_avatar
        from analytics_sessions s
        join analytics_users u on u.project_id = s.project_id and u.anon_id = s.anon_id
       where s.project_id = ${projectId} and s.last_seen_at > now() - interval '24 hours' and s.host <> ''
         and (u.user_id is not null or u.user_email is not null)
       group by 1 order by 2 desc limit 30`),
    db.execute(sql`
      select p.id, p.name, coalesce(a.enabled, false) on from projects p left join analytics_settings a on a.project_id = p.id
       where p.workspace_id = ${workspaceId} order by p.name`),
  ]);
  const proj = rows<{ id: string; name: string; on: boolean }>(projects);
  return {
    hosts: rows<{ host: string; identified: number; with_name: number; with_avatar: number }>(byHost).map((h) => ({
      host: h.host,
      identified: Number(h.identified) || 0,
      withName: Number(h.with_name) || 0,
      withAvatar: Number(h.with_avatar) || 0,
    })),
    withoutAnalytics: proj.filter((p) => !p.on).map((p) => p.name),
    analyticsOn: !!proj.find((p) => p.id === projectId)?.on,
  };
}
