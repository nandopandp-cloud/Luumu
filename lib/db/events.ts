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
 * Registra a ocorrência de um evento do workspace (chamado pela ingestão do SDK).
 * UPSERT atômico: cria na primeira vez, incrementa count e atualiza last_seen_at depois.
 */
export async function recordEvent(workspaceId: string, rawName: string) {
  const name = normalizeEventName(rawName);
  if (!name) return null;
  await db
    .insert(events)
    .values({ id: eventId(), workspaceId, name, count: 1 })
    .onConflictDoUpdate({
      target: [events.workspaceId, events.name],
      set: { count: sql`${events.count} + 1`, lastSeenAt: new Date() },
    });
  return name;
}

/** Lista os eventos do workspace (mais recentes/frequentes primeiro) para o seletor de gatilho. */
export async function listEvents(workspaceId: string) {
  return db
    .select({
      name: events.name,
      count: events.count,
      lastSeenAt: events.lastSeenAt,
    })
    .from(events)
    .where(eq(events.workspaceId, workspaceId))
    .orderBy(desc(events.lastSeenAt));
}

/** Verifica se um evento existe no workspace (usado ao salvar o gatilho de uma survey). */
export async function eventExists(workspaceId: string, name: string) {
  const [row] = await db
    .select({ name: events.name })
    .from(events)
    .where(and(eq(events.workspaceId, workspaceId), eq(events.name, normalizeEventName(name))))
    .limit(1);
  return !!row;
}
