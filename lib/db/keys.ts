import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { createHash } from "crypto";
import { db } from "./client";
import { invalidateKeyCache } from "@/lib/api/keys";
import { apiKeys } from "@/db/schema";
import { newId } from "./ids";

const rand = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 24);

export function sha256(v: string) {
  return createHash("sha256").update(v).digest("hex");
}

/** Cria um par de chaves para o projeto. Retorna a secret em claro UMA vez. */
export async function createApiKey(workspaceId: string, projectId: string, name = "Default") {
  const publicKey = `pk_${rand()}`;
  const secret = `sk_${rand()}${rand()}`;
  await db.insert(apiKeys).values({
    id: newId("key"),
    workspaceId,
    projectId,
    name,
    publicKey,
    secretHash: sha256(secret),
    domains: [],
  });
  return { publicKey, secret };
}

/** Lista as chaves ativas do projeto (sem expor a secret). */
export async function listApiKeys(projectId: string) {
  return db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      publicKey: apiKeys.publicKey,
      domains: apiKeys.domains,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.projectId, projectId), isNull(apiKeys.revokedAt)))
    .orderBy(desc(apiKeys.createdAt));
}

/** Chave pública primária do projeto (a mais antiga ativa). */
export async function getPrimaryPublicKey(projectId: string): Promise<string | null> {
  const [k] = await db
    .select({ publicKey: apiKeys.publicKey })
    .from(apiKeys)
    .where(and(eq(apiKeys.projectId, projectId), isNull(apiKeys.revokedAt)))
    .orderBy(apiKeys.createdAt)
    .limit(1);
  return k?.publicKey ?? null;
}

export async function revokeApiKey(projectId: string, id: string) {
  await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.projectId, projectId)));
  // resolveKey mantém as keys em cache; sem isto a key revogada seguiria aceita até o TTL
  invalidateKeyCache();
}

export async function setKeyDomains(projectId: string, id: string, domains: string[]) {
  await db
    .update(apiKeys)
    .set({ domains })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.projectId, projectId)));
  // a lista de domínios é checada no CORS a partir do cache: invalida para valer na hora
  invalidateKeyCache();
}
