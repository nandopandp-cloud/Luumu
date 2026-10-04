import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { identityCaptureSettings } from "@/db/schema";

export interface IdentityCapture {
  enabled: boolean;
  nameSelector: string;
  avatarSelector: string;
}

const OFF: IdentityCapture = { enabled: false, nameSelector: "", avatarSelector: "" };

// consultado em todo GET /config (que já fica em cache na borda): 60 s por instância
const cache = new Map<string, { v: IdentityCapture; exp: number }>();

/** Configuração da workspace; sem linha (ou sem a migração 0023) = desligada. */
export async function getIdentityCapture(workspaceId: string, fresh = false): Promise<IdentityCapture> {
  const hit = cache.get(workspaceId);
  if (!fresh && hit && hit.exp > Date.now()) return hit.v;
  const [r] = await db.select().from(identityCaptureSettings).where(eq(identityCaptureSettings.workspaceId, workspaceId)).limit(1);
  const v = r ? { enabled: r.enabled, nameSelector: r.nameSelector, avatarSelector: r.avatarSelector } : OFF;
  cache.set(workspaceId, { v, exp: Date.now() + 60_000 });
  return v;
}

export async function saveIdentityCapture(workspaceId: string, userId: string, v: IdentityCapture) {
  await db
    .insert(identityCaptureSettings)
    .values({ workspaceId, ...v, updatedBy: userId })
    .onConflictDoUpdate({ target: identityCaptureSettings.workspaceId, set: { ...v, updatedBy: userId, updatedAt: new Date() } });
  cache.delete(workspaceId);
}

/** Seletor CSS aceito: curto e sem nada que pareça código (vai para o SDK no site do cliente). */
export function cleanSelector(v: unknown): string {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length <= 200 && !/[<>{}`]|javascript:/i.test(s) ? s : "";
}

export interface CaptureStatus {
  /** usuários identificados (id/e-mail) ativos nas últimas 24 h, na workspace */
  identified: number;
  withName: number;
  withAvatar: number;
  /** projetos da workspace sem Analytics ativo: lá a captura não roda */
  withoutAnalytics: string[];
}

/** Está funcionando? Números reais das últimas 24 h + onde falta ligar o Analytics. */
export async function identityCaptureStatus(workspaceId: string): Promise<CaptureStatus> {
  const rows = <T,>(r: unknown) => ((r as { rows?: T[] }).rows ?? (r as T[])) as T[];
  const [counts, projects] = await Promise.all([
    db.execute(sql`
      select count(*)::int identified,
             count(*) filter (where u.user_name is not null)::int with_name,
             count(*) filter (where u.user_avatar is not null)::int with_avatar
        from analytics_users u join projects p on p.id = u.project_id
       where p.workspace_id = ${workspaceId} and u.last_seen_at > now() - interval '24 hours'
         and (u.user_id is not null or u.user_email is not null)`),
    db.execute(sql`
      select p.name from projects p left join analytics_settings a on a.project_id = p.id
       where p.workspace_id = ${workspaceId} and coalesce(a.enabled, false) = false order by p.name`),
  ]);
  const c = rows<{ identified: number; with_name: number; with_avatar: number }>(counts)[0];
  return {
    identified: Number(c?.identified) || 0,
    withName: Number(c?.with_name) || 0,
    withAvatar: Number(c?.with_avatar) || 0,
    withoutAnalytics: rows<{ name: string }>(projects).map((p) => p.name),
  };
}
