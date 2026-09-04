import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "./client";
import { events } from "@/db/schema";
import { eventId } from "./ids";

/**
 * Normaliza o nome do evento em um slug estável e determinístico.
 * Remove acentos (NFD) antes do slug para que "Concluído" e "concluido" colidam.
 * DEVE ser idêntico ao slug() do SDK (sdk/luumu.ts).
 */
export function normalizeEventName(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove marcas de acento combinantes
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 64);
}

/**
 * Registra a ocorrência de um evento do projeto (chamado pela ingestão do SDK).
 * UPSERT atômico: cria na primeira vez, incrementa count e atualiza last_seen_at depois.
 * A unicidade é por (projeto, nome), o mesmo evento pode existir em projetos diferentes.
 */
export async function recordEvent(workspaceId: string, projectId: string, rawName: string) {
  const name = normalizeEventName(rawName);
  if (!name) return null;

  // O catálogo existe para o cliente ESCOLHER gatilhos de pesquisa: o que importa é que o
  // evento exista no projeto, não quantas vezes ocorreu. Depois que (projeto, evento) já foi
  // visto, todo novo INSERT viraria um UPSERT que não muda nada de decisivo — era 1 escrita
  // por clique rastreado em todos os sites dos clientes. Com o par em memória, o caso comum
  // ("evento já conhecido") não vai ao banco.
  if (isKnownEvent(projectId, name)) return name;

  await db
    .insert(events)
    .values({ id: eventId(), workspaceId, projectId, name, count: 1 })
    .onConflictDoUpdate({
      target: [events.projectId, events.name],
      set: { count: sql`${events.count} + 1`, lastSeenAt: new Date() },
    });

  markKnownEvent(projectId, name);
  return name;
}

/**
 * Pares (projeto, evento) já gravados por esta instância. Só cresce com eventos DISTINTOS —
 * um projeto tem dezenas deles, não milhões —, e o LRU limita o pior caso (key inválida
 * gerando nomes aleatórios). Perder o cache num lambda novo custa 1 UPSERT, nada mais:
 * a unicidade real continua garantida pelo índice (project_id, name) no banco.
 */
const KNOWN_MAX = 5000;
const knownEvents = new Map<string, true>();

function isKnownEvent(projectId: string, name: string): boolean {
  return knownEvents.has(`${projectId}:${name}`);
}

function markKnownEvent(projectId: string, name: string) {
  if (knownEvents.size >= KNOWN_MAX) {
    // descarta a entrada mais antiga (Map preserva ordem de inserção)
    const oldest = knownEvents.keys().next().value;
    if (oldest !== undefined) knownEvents.delete(oldest);
  }
  knownEvents.set(`${projectId}:${name}`, true);
}

/** Esquece o catálogo em memória de um projeto (usar se os eventos forem apagados). */
export function invalidateEventCache() {
  knownEvents.clear();
}

/** Lista os eventos do projeto (mais recentes/frequentes primeiro) para o seletor de gatilho. */
export async function listEvents(projectId: string) {
  return db
    .select({
      name: events.name,
      count: events.count,
      lastSeenAt: events.lastSeenAt,
    })
    .from(events)
    .where(eq(events.projectId, projectId))
    .orderBy(desc(events.lastSeenAt));
}

/** Verifica se um evento existe no projeto (usado ao salvar o gatilho de uma survey). */
export async function eventExists(projectId: string, name: string) {
  const [row] = await db
    .select({ name: events.name })
    .from(events)
    .where(and(eq(events.projectId, projectId), eq(events.name, normalizeEventName(name))))
    .limit(1);
  return !!row;
}
