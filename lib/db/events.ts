import "server-only";
import { and, count, desc, eq } from "drizzle-orm";
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
 * Registra um evento INÉDITO do projeto (chamado pela ingestão do SDK).
 *
 * O catálogo responde a uma única pergunta: "que eventos existem neste produto?" — é a lista
 * que o cliente usa para escolher gatilhos de pesquisa. A primeira vez que alguém entra em
 * /biblioteca, a rota vira um evento conhecido; as visitas seguintes não acrescentam nada.
 * Por isso repetição não é gravada: nem em memória (caso comum), nem no banco.
 *
 * `onConflictDoNothing` é o que fecha a conta: quando o cache está frio (lambda nova), o
 * INSERT de um evento já catalogado é descartado pelo índice (project_id, name) sem escrever
 * nada — antes, esse mesmo caso virava UPDATE de count/last_seen_at, ou seja, escrita a cada
 * ocorrência. O nome é devolvido de todo jeito, porque quem chama usa isso para casar gatilhos.
 */
export async function recordEvent(workspaceId: string, projectId: string, rawName: string) {
  const name = normalizeEventName(rawName);
  if (!name) return null;

  if (isKnownEvent(projectId, name)) return name;

  /*
    Teto de eventos distintos por projeto. O SDK já normaliza rotas e rótulos, mas ele roda
    no navegador do cliente: uma versão antiga, um `luumu.track()` com id concatenado ou uma
    página adulterada ainda podem inventar nomes novos indefinidamente. Sem teto, cada nome
    inédito é uma linha nova e uma escrita — foi assim que o catálogo chegou a 200 mil.
    Ao atingir o limite, o evento continua valendo como gatilho (o nome é devolvido), só não
    entra no catálogo.
  */
  if (await isCatalogFull(projectId)) return name;

  await db
    .insert(events)
    .values({ id: eventId(), workspaceId, projectId, name, count: 1 })
    .onConflictDoNothing({ target: [events.projectId, events.name] });

  markKnownEvent(projectId, name);
  return name;
}

/** Limite de eventos distintos por projeto: o catálogo é uma lista para escolher gatilhos. */
const MAX_EVENTS_PER_PROJECT = 300;
const catalogCount = new Map<string, { n: number; checkedAt: number }>();
const COUNT_TTL_MS = 10 * 60 * 1000;

async function isCatalogFull(projectId: string): Promise<boolean> {
  const cached = catalogCount.get(projectId);
  const now = Date.now();
  if (cached && now - cached.checkedAt < COUNT_TTL_MS) {
    if (cached.n >= MAX_EVENTS_PER_PROJECT) return true;
    cached.n += 1; // otimista: contamos a inserção que está prestes a acontecer
    return false;
  }
  const [row] = await db
    .select({ n: count() })
    .from(events)
    .where(eq(events.projectId, projectId));
  const n = Number(row?.n ?? 0);
  catalogCount.set(projectId, { n: n + 1, checkedAt: now });
  return n >= MAX_EVENTS_PER_PROJECT;
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
