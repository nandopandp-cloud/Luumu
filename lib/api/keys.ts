import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { apiKeys } from "@/db/schema";

export interface ResolvedKey {
  workspaceId: string;
  domains: string[];
}

/** Resolve uma SDK key pública (pk_) para o workspace, se ativa. Atualiza lastUsedAt. */
export async function resolveKey(publicKey: string | null): Promise<ResolvedKey | null> {
  if (!publicKey || !publicKey.startsWith("pk_")) return null;
  const [row] = await db
    .select({ id: apiKeys.id, workspaceId: apiKeys.workspaceId, domains: apiKeys.domains })
    .from(apiKeys)
    .where(and(eq(apiKeys.publicKey, publicKey), isNull(apiKeys.revokedAt)))
    .limit(1);
  if (!row) return null;
  // best-effort: marca uso (não bloqueia a resposta)
  db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id)).catch(() => {});
  return { workspaceId: row.workspaceId, domains: (row.domains as string[]) ?? [] };
}
