import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { rateLimits } from "@/db/schema";

/**
 * Rate limit por janela fixa de 1 minuto, contando por bucket (ex.: ip+key).
 * Usa UPSERT atômico no Postgres; reinicia a contagem quando a janela expira.
 * Retorna true se DENTRO do limite, false se excedeu.
 */
export async function checkRateLimit(key: string, limit = 60, windowSec = 60): Promise<boolean> {
  const now = new Date();
  const windowId = Math.floor(now.getTime() / (windowSec * 1000));
  const bucket = `${key}:${windowId}`;

  try {
    const rows = await db
      .insert(rateLimits)
      .values({ bucket, count: 1, windowStart: now })
      .onConflictDoUpdate({
        target: rateLimits.bucket,
        set: { count: sql`${rateLimits.count} + 1` },
      })
      .returning({ count: rateLimits.count });
    const count = rows[0]?.count ?? 1;
    return count <= limit;
  } catch {
    // em caso de falha do store, não bloqueia (fail-open)
    return true;
  }
}
