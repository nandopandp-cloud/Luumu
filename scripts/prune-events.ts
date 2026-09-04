/**
 * Limpa o catálogo de eventos, que cresceu sem limite antes da normalização de rotas/rótulos
 * no SDK: cada id em URL ("/quiz/<uuid>/result") virava um evento distinto.
 *
 * PRINCÍPIO: o catálogo deve ter UM registro por rota/ação existente no produto. O objetivo é
 * remover as variações da MESMA rota, nunca rotas diferentes. Por isso a regra é conservadora
 * — só agrupa o que é comprovadamente a mesma tela com um identificador no meio:
 *
 *   REMOVE (mesma rota, ids diferentes)      /quiz/<uuid>/result, /quiz/<outro-uuid>/result
 *   MANTÉM (rotas diferentes de verdade)     /enem/2024 e /enem/2025, /trilha/1 e /trilha/2
 *
 * Números "crus" (2024, 1, 2) NÃO são tratados como id: podem ser ano, série ou nível — telas
 * legítimas do produto. Só viram id os formatos que não têm como ser rota escrita à mão:
 * uuid, hash hexadecimal longo e id com prefixo (usr_ab12cd34).
 *
 * Eventos usados como gatilho de alguma survey são SEMPRE preservados.
 *
 *   npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/prune-events.ts          # simula
 *   npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/prune-events.ts --apply  # aplica
 */
import "dotenv/config";
import { inArray } from "drizzle-orm";
import { db } from "../lib/db/client";
import { events, surveys } from "../db/schema";

const APPLY = process.argv.includes("--apply");

/**
 * Só substitui trechos que são inequivocamente identificadores gerados por máquina.
 * Um evento sem nenhum identificador assim é único por definição e nunca entra em grupo.
 */
function pattern(name: string): string {
  return name
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id") // uuid
    .replace(/\b[0-9a-f]{16,}\b/gi, ":id") // hash hex longo
    // id com prefixo (usr_ab12cd34): exige dígito E letra na parte aleatória, senão
    // "link_biblioteca" e "page_view_biblioteca" seriam confundidos com identificadores
    .replace(/\b[a-z]{2,5}_(?=[A-Za-z0-9]*\d)(?=[A-Za-z0-9]*[a-zA-Z])[A-Za-z0-9]{8,}\b/g, ":id")
    .replace(/\b\d{6,}\b/g, ":id"); // sequência longa de dígitos (timestamp, id numérico)
}

async function main() {
  const all = await db
    .select({ id: events.id, projectId: events.projectId, name: events.name, lastSeenAt: events.lastSeenAt })
    .from(events);
  console.log(`eventos no catálogo: ${all.length}`);

  const rows = await db.select({ te: surveys.triggerEvent, tes: surveys.triggerEvents }).from(surveys);
  const inUse = new Set<string>();
  for (const r of rows) {
    if (r.te) inUse.add(r.te);
    for (const e of (r.tes as string[] | null) ?? []) inUse.add(e);
  }
  console.log(`nomes usados como gatilho (preservados): ${inUse.size}`);

  // agrupa só o que tem identificador de máquina; o resto é único e fica intocado
  const groups = new Map<string, { id: string; name: string; t: number }[]>();
  const keep = new Set<string>();

  for (const e of all) {
    const p = pattern(e.name);
    if (inUse.has(e.name) || p === e.name) {
      keep.add(e.id); // gatilho em uso, ou nome sem id → rota única, preserva
      continue;
    }
    const k = `${e.projectId}::${p}`;
    const t = e.lastSeenAt ? new Date(e.lastSeenAt as unknown as string).getTime() : 0;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push({ id: e.id, name: e.name, t });
  }

  const toDelete: string[] = [];
  for (const [k, list] of groups) {
    list.sort((a, b) => b.t - a.t);
    keep.add(list[0].id); // mantém um representante da rota
    for (const dup of list.slice(1)) toDelete.push(dup.id);
    if (list.length > 1) {
      console.log(`  ${k.split("::")[1]}  →  1 mantido, ${list.length - 1} duplicados`);
    }
  }

  console.log(`\nmanter: ${keep.size}   apagar (duplicados da mesma rota): ${toDelete.length}`);

  if (!APPLY) {
    console.log("(simulação — nada foi alterado; rode com --apply para executar)");
    return;
  }
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
