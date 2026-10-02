import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "./client";
import { projectHosts } from "@/db/schema";
import { projectHostId } from "./ids";
import { normalizeHost } from "@/lib/hosts";

export { normalizeHost };

/** Hostname da origem de uma request (header `Origin`), ou "" quando ausente/inválido. */
export function hostFromOrigin(origin: string | null): string {
  if (!origin || origin === "null") return "";
  return normalizeHost(origin);
}

/**
 * Teto de plataformas por projeto. O SDK roda no navegador, então um hostname é dado do
 * cliente: sem teto, uma página adulterada poderia inventar hosts indefinidamente. Um cliente
 * real tem um punhado de produtos (mais ambientes de homologação), não centenas.
 */
const MAX_HOSTS_PER_PROJECT = 50;

/*
  Pares (projeto, host) já gravados por esta instância. No caso comum — host conhecido — o
  banco não é tocado. Perder o cache num lambda novo custa um INSERT ... ON CONFLICT DO NOTHING.
*/
const KNOWN_MAX = 2000;
const knownHosts = new Map<string, true>();

function markKnown(projectId: string, host: string) {
  if (knownHosts.size >= KNOWN_MAX) {
    const oldest = knownHosts.keys().next().value;
    if (oldest !== undefined) knownHosts.delete(oldest);
  }
  knownHosts.set(`${projectId}:${host}`, true);
}

// hosts recusados pelo teto, por instância: não insiste a cada request (expira para reavaliar)
const REJECTED_TTL_MS = 10 * 60 * 1000;
const rejectedHosts = new Map<string, number>();

/**
 * Registra a plataforma em que o SDK do projeto está rodando (idempotente).
 * O teto é aplicado dentro do próprio INSERT, como em recordEvents (lib/db/events.ts), para
 * valer mesmo com várias instâncias gravando ao mesmo tempo.
 *
 * Devolve se o host faz parte das plataformas do projeto. Quem grava dados por plataforma
 * (o catálogo de eventos) só deve fazê-lo quando isto for true — senão o teto de plataformas
 * não limitaria nada.
 */
export async function recordHost(workspaceId: string, projectId: string, rawHost: string): Promise<boolean> {
  const host = normalizeHost(rawHost);
  if (!host) return false;
  const key = `${projectId}:${host}`;
  if (knownHosts.has(key)) return true;
  if ((rejectedHosts.get(key) ?? 0) > Date.now()) return false;

  const inserted = await db.execute<{ host: string }>(sql`
    insert into ${projectHosts} (id, workspace_id, project_id, host)
    select ${projectHostId()}, ${workspaceId}, ${projectId}, ${host}
     where (select count(*) from ${projectHosts} where ${projectHosts.projectId} = ${projectId})
           < ${MAX_HOSTS_PER_PROJECT}
    on conflict (project_id, host) do nothing
    returning host
  `);
  // não entrou: ou já existia (cache frio desta instância) ou o projeto está no teto
  const exists =
    (inserted.rows ?? []).length > 0 ||
    (
      await db
        .select({ host: projectHosts.host })
        .from(projectHosts)
        .where(and(eq(projectHosts.projectId, projectId), eq(projectHosts.host, host)))
        .limit(1)
    ).length > 0;

  if (exists) markKnown(projectId, host);
  else rejectedHosts.set(key, Date.now() + REJECTED_TTL_MS);
  return exists;
}

/** Plataformas do projeto, na ordem em que foram detectadas. */
export async function listHosts(projectId: string): Promise<string[]> {
  const rows = await db
    .select({ host: projectHosts.host })
    .from(projectHosts)
    .where(eq(projectHosts.projectId, projectId))
    .orderBy(asc(projectHosts.firstSeenAt));
  return rows.map((r) => r.host);
}

/**
 * Estado que o SDK precisa para saber se deve se apresentar ao servidor. Vai junto com
 * /config (cacheado na borda e no navegador), então não custa request a mais: só um host que
 * o projeto ainda não conhece gera um POST — uma vez, e não por visitante para sempre.
 * Projeto no teto responde `known: true`: o SDK não insiste num host que não seria gravado.
 */
export async function hostStateForSdk(projectId: string, host: string): Promise<{ known: boolean }> {
  if (!host) return { known: true };
  if (knownHosts.has(`${projectId}:${host}`)) return { known: true };
  const hosts = await listHosts(projectId);
  if (hosts.includes(host)) {
    markKnown(projectId, host);
    return { known: true };
  }
  if (hosts.length >= MAX_HOSTS_PER_PROJECT) return { known: true };
  return { known: false };
}

