import "server-only";
import { eq } from "drizzle-orm";
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
