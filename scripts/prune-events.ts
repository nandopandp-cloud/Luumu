/**
 * Limpa o catálogo de eventos, que cresceu sem limite antes da normalização de rotas/rótulos
 * no SDK: cada id em URL ("/quiz/<uuid>/result") e cada rótulo com número ("unidade 6…")
 * virava um evento distinto.
 *
 * O que faz: reagrupa os eventos existentes pelo padrão da rota/rótulo, mantém um registro
 * por padrão (o mais recente) e apaga o resto. Eventos usados como gatilho de alguma survey
 * são SEMPRE preservados, para não quebrar pesquisas no ar.
 *
 *   npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/prune-events.ts          # simula
 *   npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/prune-events.ts --apply  # aplica
 */
import "dotenv/config";
import { inArray } from "drizzle-orm";
import { db } from "../lib/db/client";
import { events, surveys } from "../db/schema";

const APPLY = process.argv.includes("--apply");

/** Mesma ideia do routePattern/labelPattern do SDK, aplicada a nomes já gravados. */
function pattern(name: string): string {
  return name
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "id")
    .replace(/[0-9a-f]{16,}/gi, "id")
    .replace(/\d+/g, "n")
    .replace(/_{2,}/g, "_")
    .slice(0, 64);
}

async function main() {
  const all = await db
    .select({ id: events.id, projectId: events.projectId, name: events.name, lastSeenAt: events.lastSeenAt })
    .from(events);
  console.log(`eventos no catálogo: ${all.length}`);

  // nomes em uso como gatilho: nunca remover
  const rows = await db.select({ te: surveys.triggerEvent, tes: surveys.triggerEvents }).from(surveys);
  const inUse = new Set<string>();
  for (const r of rows) {
    if (r.te) inUse.add(r.te);
    for (const e of (r.tes as string[] | null) ?? []) inUse.add(e);
  }
  console.log(`nomes usados como gatilho (preservados): ${inUse.size}`);

  // agrupa por (projeto, padrão) e mantém o mais recente de cada grupo
  const keep = new Set<string>();
  const best = new Map<string, { id: string; t: number }>();
  for (const e of all) {
    if (inUse.has(e.name)) {
      keep.add(e.id);
      continue;
    }
    const k = `${e.projectId}::${pattern(e.name)}`;
    const t = e.lastSeenAt ? new Date(e.lastSeenAt as unknown as string).getTime() : 0;
    const cur = best.get(k);
    if (!cur || t > cur.t) best.set(k, { id: e.id, t });
  }
  for (const b of best.values()) keep.add(b.id);

  const toDelete = all.filter((e) => !keep.has(e.id)).map((e) => e.id);
  console.log(`manter: ${keep.size}   apagar: ${toDelete.length}`);

  if (!APPLY) {
    console.log("\n(simulação — nada foi alterado; rode com --apply para executar)");
    return;
  }
  // apaga em lotes: um IN gigante estoura o limite de parâmetros do Postgres
  const BATCH = 500;
  for (let i = 0; i < toDelete.length; i += BATCH) {
    await db.delete(events).where(inArray(events.id, toDelete.slice(i, i + BATCH)));
    console.log(`  apagados ${Math.min(i + BATCH, toDelete.length)}/${toDelete.length}`);
  }
  console.log("concluído.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
