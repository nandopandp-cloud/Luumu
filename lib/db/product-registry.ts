import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "./client";
import { productElements, productRoutes } from "@/db/schema";
import { productElementId, productRouteId } from "./ids";
import { normalizeTarget, normalizeRoute } from "@/lib/tours/normalize";
import type { ElementTarget } from "@/lib/tours/types";

/*
  Element Registry: o que o Product Discovery Engine encontrou no produto do cliente, por
  plataforma e rota. Escrito só em modo builder (token de administrador), nunca pelo tráfego
  dos usuários finais.
*/

const MAX_ELEMENTS_PER_ROUTE = 300;
const MAX_ELEMENTS_PER_PROJECT = 3000;

/** Grava os elementos de uma rota (upsert pelo fingerprint). Devolve quantos foram aceitos. */
export async function recordDiscovery(input: {
  workspaceId: string;
  projectId: string;
  host: string;
  route: unknown;
  title: unknown;
  elements: unknown[];
}): Promise<number> {
  const route = normalizeRoute(input.route);
  if (!route || !input.host) return 0;
  const targets = input.elements
    .slice(0, MAX_ELEMENTS_PER_ROUTE)
    .map(normalizeTarget)
    .filter((t): t is ElementTarget => t !== null);
  // dedupe por fingerprint dentro do lote (o upsert não aceita a mesma chave duas vezes)
  const unique = Array.from(new Map(targets.map((t) => [t.fingerprint, t])).values());

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(productElements)
    .where(eq(productElements.projectId, input.projectId));
  const room = Math.max(0, MAX_ELEMENTS_PER_PROJECT - Number(n));
  const now = new Date();
  const title = typeof input.title === "string" ? input.title.slice(0, 160) : "";

  const upsertRoute = db
    .insert(productRoutes)
    .values({
      id: productRouteId(),
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      host: input.host,
      route,
      title,
      elementCount: unique.length,
      lastSeenAt: now,
    })
    .onConflictDoUpdate({
      target: [productRoutes.projectId, productRoutes.host, productRoutes.route],
      set: { title, elementCount: unique.length, lastSeenAt: now },
    });

  /*
    Teto do registro por projeto: com ele cheio a rota continua registrada, mas elementos não
    entram. `room` é conservador (conta como novos os que só seriam atualizados) — o custo é
    o registro encher um pouco antes, nunca passar do limite.
  */
  const batch = unique.slice(0, room);
  if (!batch.length) {
    await upsertRoute;
    return 0;
  }
  await db.batch([
    upsertRoute,
    db
      .insert(productElements)
      .values(
        batch.map((t) => ({
          id: productElementId(),
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          host: input.host,
          route,
          fingerprint: t.fingerprint,
          kind: t.kind,
          label: t.label,
          target: t,
          stability: t.stability,
          lastSeenAt: now,
        }))
      )
      .onConflictDoUpdate({
        target: [productElements.projectId, productElements.host, productElements.route, productElements.fingerprint],
        set: {
          kind: sql`excluded.kind`,
          label: sql`excluded.label`,
          target: sql`excluded.target`,
          stability: sql`excluded.stability`,
          lastSeenAt: now,
        },
      }),
  ]);
  return batch.length;
}

export interface RegistryElement {
  id: string;
  host: string;
  route: string;
  kind: string;
  label: string;
  stability: number;
  target: ElementTarget;
  lastSeenAt: Date;
}

/** Elementos descobertos do projeto (para o seletor de alvo do builder). */
export async function listRegistry(projectId: string, host?: string): Promise<RegistryElement[]> {
  const rows = await db
    .select()
    .from(productElements)
    .where(and(eq(productElements.projectId, projectId), host ? eq(productElements.host, host) : undefined))
    .orderBy(productElements.route, desc(productElements.stability))
    .limit(MAX_ELEMENTS_PER_PROJECT);
  return rows
    .map((r) => {
      const target = normalizeTarget(r.target);
      return target
        ? { id: r.id, host: r.host, route: r.route, kind: r.kind, label: r.label, stability: r.stability, target, lastSeenAt: r.lastSeenAt }
        : null;
    })
    .filter((r): r is RegistryElement => r !== null);
}
