import "server-only";
import { and, asc, count, eq } from "drizzle-orm";
import { db } from "./client";
import { colorFavorites } from "@/lib/db/schema";
import { normalizeHexColor } from "@/lib/utils/color";

/*
  Cores favoritas da workspace (editor de aparência das pesquisas). Valem para todas as
  pesquisas e para todo o time. Sem a migração 0046 as consultas falham: quem chama trata
  como "favoritos indisponíveis" e o resto da tela segue normal.
*/

export const MAX_FAVORITE_COLORS = 16;

/** Favoritas na ordem em que foram salvas; `null` = tabela ainda não existe (migração 0046). */
export async function listFavoriteColors(workspaceId: string): Promise<string[] | null> {
  try {
    const rows = await db
      .select({ color: colorFavorites.color })
      .from(colorFavorites)
      .where(eq(colorFavorites.workspaceId, workspaceId))
      .orderBy(asc(colorFavorites.createdAt));
    return rows.map((r) => r.color);
  } catch {
    return null;
  }
}

export async function addFavoriteColor(workspaceId: string, color: string, userId: string): Promise<"ok" | "invalid" | "full"> {
  const hex = normalizeHexColor(color);
  if (!hex) return "invalid";
  const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(colorFavorites).where(eq(colorFavorites.workspaceId, workspaceId));
  if (Number(n) >= MAX_FAVORITE_COLORS) return "full";
  await db.insert(colorFavorites).values({ workspaceId, color: hex, createdBy: userId }).onConflictDoNothing();
  return "ok";
}

export async function removeFavoriteColor(workspaceId: string, color: string) {
  const hex = normalizeHexColor(color);
  if (!hex) return;
  await db.delete(colorFavorites).where(and(eq(colorFavorites.workspaceId, workspaceId), eq(colorFavorites.color, hex)));
}
