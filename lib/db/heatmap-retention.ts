import "server-only";
import { db } from "./client";
import { heatmapPageviews, heatmapSnapshots } from "@/db/schema";
import { lt } from "drizzle-orm";
import { sql } from "drizzle-orm";

/** Retenção de 90 dias para heatmaps (mantém banco sob controle). */
export async function cleanOldHeatmaps() {
  const cutoff = sql`now() - interval '90 days'`;
  try {
    const [pv, snap] = await Promise.all([
      db.delete(heatmapPageviews).where(lt(heatmapPageviews.createdAt, cutoff)),
      db.delete(heatmapSnapshots).where(lt(heatmapSnapshots.createdAt, cutoff)),
    ]);
    return { pageviews: pv.rowCount, snapshots: snap.rowCount };
  } catch (e) {
    console.error("[heatmap-retention]", e);
    return { pageviews: 0, snapshots: 0, error: String(e) };
  }
}
