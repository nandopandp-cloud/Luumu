import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { apiKeys } from "@/db/schema";

export interface ResolvedKey {
  workspaceId: string;
  projectId: string;
  domains: string[];
}

/**
 * Cache de SDK keys por instância (lambda). Uma key resolve sempre para o mesmo projeto:
 * o que muda é revogação e lista de domínios — raro, e tolerar até TTL de atraso é aceitável
 * para evitar um SELECT em toda chamada do SDK. Negativos entram com TTL curto para que uma
 * key inválida repetida (bot, integração quebrada) não vire um SELECT por requisição.
 */
const TTL_MS = 5 * 60 * 1000;
const TTL_MISS_MS = 30 * 1000;
const cache = new Map<string, { value: ResolvedKey | null; expires: number }>();

/**
 * Marca de uso (`lastUsedAt`) é telemetria, não dado crítico: gravar a cada requisição
 * era 1 UPDATE por evento. Aqui só grava se passou o intervalo, mantendo a informação
 * "esta key está ativa" com uma fração das escritas.
 */
const LAST_USED_INTERVAL_MS = 15 * 60 * 1000;
const lastUsedWrite = new Map<string, number>();

/** Invalida o cache de uma key (usar ao revogar ou alterar domínios). */
export function invalidateKeyCache(publicKey?: string) {
  if (publicKey) cache.delete(publicKey);
  else cache.clear();
}

/** Resolve uma SDK key pública (pk_) para o projeto, se ativa. */
export async function resolveKey(publicKey: string | null): Promise<ResolvedKey | null> {
  if (!publicKey || !publicKey.startsWith("pk_")) return null;

  const now = Date.now();
  const hit = cache.get(publicKey);
  if (hit && hit.expires > now) {
    if (hit.value) touch(publicKey, hit.value, now);
    return hit.value;
  }

  const [row] = await db
    .select({ id: apiKeys.id, workspaceId: apiKeys.workspaceId, projectId: apiKeys.projectId, domains: apiKeys.domains })
    .from(apiKeys)
    .where(and(eq(apiKeys.publicKey, publicKey), isNull(apiKeys.revokedAt)))
    .limit(1);

  if (!row) {
    cache.set(publicKey, { value: null, expires: now + TTL_MISS_MS });
    return null;
  }

  const value: ResolvedKey = {
    workspaceId: row.workspaceId,
    projectId: row.projectId,
    domains: (row.domains as string[]) ?? [],
  };
  cache.set(publicKey, { value, expires: now + TTL_MS });
  keyIdByPublicKey.set(publicKey, row.id);
  touch(publicKey, value, now);
  return value;
}

// id interno da key, guardado à parte para o UPDATE amostrado não exigir novo SELECT
const keyIdByPublicKey = new Map<string, string>();

/** Grava `lastUsedAt` no máximo uma vez por LAST_USED_INTERVAL_MS por key (best-effort). */
function touch(publicKey: string, _value: ResolvedKey, now: number) {
  const last = lastUsedWrite.get(publicKey) ?? 0;
  if (now - last < LAST_USED_INTERVAL_MS) return;
  const id = keyIdByPublicKey.get(publicKey);
  if (!id) return;
  lastUsedWrite.set(publicKey, now);
  db.update(apiKeys).set({ lastUsedAt: new Date(now) }).where(eq(apiKeys.id, id)).catch(() => {});
}
