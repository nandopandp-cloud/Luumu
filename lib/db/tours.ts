import "server-only";
import { and, asc, desc, eq, inArray, ne, sql, max } from "drizzle-orm";
import { db } from "./client";
import { tours, tourVersions, tourSteps, tourEvents, users } from "@/db/schema";
import { tourId as newTourId, tourVersionId, tourStepId } from "./ids";
import { defaultSettings, starterSteps } from "@/lib/tours/defaults";
import { normalizeSettings, normalizeSteps, normalizeStep, normalizeTarget, normalizeRoute } from "@/lib/tours/normalize";
import { normalizeHost } from "@/lib/hosts";
import type { ElementTarget, TourCatalogEntry, TourPayload, TourSettings, TourStep } from "@/lib/tours/types";

/*
  Camada de dados do Product Tours. Toda função recebe o projeto e confere a posse antes de
  ler ou escrever (multi-tenancy): o painel passa o projeto da sessão, a API pública o
  projeto resolvido pela SDK key, e as rotas de builder o projeto do token.
*/

type TourRow = typeof tours.$inferSelect;
type StepRow = typeof tourSteps.$inferSelect;

export type TourStatus = "draft" | "published" | "archived";

/* ---------- conversão passo <-> linha ---------- */

function stepToRow(step: TourStep, versionId: string, tourId: string, order: number) {
  const { key, type, title, body, route, target, ...config } = step;
  return { id: tourStepId(), versionId, tourId, key, order, type, title, body, route, target, config };
}

function stepFromRow(row: StepRow): TourStep {
  return normalizeStep({
    ...((row.config as object) ?? {}),
    key: row.key,
    type: row.type,
    title: row.title,
    body: row.body,
    route: row.route,
    target: row.target,
  });
}

const settingsOf = (raw: unknown): TourSettings => normalizeSettings(raw, normalizeHost);

/* ---------- posse ---------- */

async function ownedTour(id: string, projectId: string): Promise<TourRow | null> {
  const [row] = await db
    .select()
    .from(tours)
    .where(and(eq(tours.id, id), eq(tours.projectId, projectId)))
    .limit(1);
  return row ?? null;
}

async function draftVersion(tourId: string) {
  const [row] = await db
    .select()
    .from(tourVersions)
    .where(and(eq(tourVersions.tourId, tourId), eq(tourVersions.version, 0)))
    .limit(1);
  return row ?? null;
}

async function stepsOf(versionId: string): Promise<TourStep[]> {
  const rows = await db.select().from(tourSteps).where(eq(tourSteps.versionId, versionId)).orderBy(asc(tourSteps.order));
  return rows.map(stepFromRow);
}

/* ---------- painel ---------- */

export interface TourListItem {
  id: string;
  name: string;
  description: string;
  status: TourStatus;
  version: number | null;
  stepCount: number;
  hasUnpublishedChanges: boolean;
  targetHosts: string[];
  started: number;
  completed: number;
  updatedAt: Date;
  creator: { name: string; avatarUrl: string | null } | null;
}

/** Tours do projeto com contagens de execução (sessões distintas). 4 queries no total. */
export async function listTours(projectId: string): Promise<TourListItem[]> {
  const rows = await db.select().from(tours).where(eq(tours.projectId, projectId)).orderBy(desc(tours.updatedAt));
  if (rows.length === 0) return [];
  const ids = rows.map((t) => t.id);
  const creatorIds = Array.from(new Set(rows.map((t) => t.createdBy).filter((v): v is string => !!v)));

  const [versions, stepCounts, metrics, creators] = await Promise.all([
    db
      .select({ id: tourVersions.id, tourId: tourVersions.tourId, version: tourVersions.version, settings: tourVersions.settings })
      .from(tourVersions)
      .where(and(inArray(tourVersions.tourId, ids), eq(tourVersions.version, 0))),
    db
      .select({ tourId: tourSteps.tourId, versionId: tourSteps.versionId, n: sql<number>`count(*)::int` })
      .from(tourSteps)
      .where(inArray(tourSteps.tourId, ids))
      .groupBy(tourSteps.tourId, tourSteps.versionId),
    db
      .select({
        tourId: tourEvents.tourId,
        type: tourEvents.type,
        n: sql<number>`count(distinct coalesce(${tourEvents.sessionId}, ${tourEvents.id}))::int`,
      })
      .from(tourEvents)
      .where(and(inArray(tourEvents.tourId, ids), inArray(tourEvents.type, ["tour_started", "tour_completed"])))
      .groupBy(tourEvents.tourId, tourEvents.type),
    creatorIds.length
      ? db.select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, creatorIds))
      : Promise.resolve([]),
  ]);

  const publishedNumbers = await publishedVersionNumbers(rows);
  const draftByTour = new Map(versions.map((v) => [v.tourId, v]));
  const stepsByVersion = new Map(stepCounts.map((s) => [s.versionId, Number(s.n)]));
  const metric = (id: string, type: string) => metrics.find((m) => m.tourId === id && m.type === type)?.n ?? 0;
  const creatorById = new Map(creators.map((u) => [u.id, u]));

  return rows.map((t) => {
    const draft = draftByTour.get(t.id);
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      status: t.status as TourStatus,
      version: publishedNumbers.get(t.id) ?? null,
      stepCount: draft ? stepsByVersion.get(draft.id) ?? 0 : 0,
      hasUnpublishedChanges: t.hasUnpublishedChanges,
      targetHosts: draft ? settingsOf(draft.settings).targetHosts : [],
      started: Number(metric(t.id, "tour_started")),
      completed: Number(metric(t.id, "tour_completed")),
      updatedAt: t.updatedAt,
      creator: t.createdBy ? creatorById.get(t.createdBy) ?? null : null,
    };
  });
}

async function publishedVersionNumbers(rows: TourRow[]): Promise<Map<string, number>> {
  const ids = rows.map((t) => t.publishedVersionId).filter((v): v is string => !!v);
  if (!ids.length) return new Map();
  const vs = await db
    .select({ tourId: tourVersions.tourId, version: tourVersions.version })
    .from(tourVersions)
    .where(inArray(tourVersions.id, ids));
  return new Map(vs.map((v) => [v.tourId, v.version]));
}

export interface TourVersionItem {
  id: string;
  version: number;
  status: string;
  publishedAt: Date | null;
  publishedBy: { name: string; avatarUrl: string | null } | null;
  stepCount: number;
}

export interface TourEditorData {
  tour: { id: string; name: string; description: string; status: TourStatus; hasUnpublishedChanges: boolean; updatedAt: Date };
  settings: TourSettings;
  steps: TourStep[];
  publishedVersion: number | null;
}

/** Tudo que o builder precisa: o rascunho (passos + configurações) e a versão no ar. */
export async function getTourEditor(id: string, projectId: string): Promise<TourEditorData | null> {
  const tour = await ownedTour(id, projectId);
  if (!tour) return null;
  const draft = await ensureDraft(tour);
  const [steps, published] = await Promise.all([stepsOf(draft.id), publishedVersionNumbers([tour])]);
  return {
    tour: {
      id: tour.id,
      name: tour.name,
      description: tour.description,
      status: tour.status as TourStatus,
      hasUnpublishedChanges: tour.hasUnpublishedChanges,
      updatedAt: tour.updatedAt,
    },
    settings: settingsOf(draft.settings),
    steps,
    publishedVersion: published.get(tour.id) ?? null,
  };
}

/** Garante a versão 0 (rascunho). Só falta em dado corrompido; recria vazia em vez de quebrar. */
async function ensureDraft(tour: TourRow) {
  const existing = await draftVersion(tour.id);
  if (existing) return existing;
  const [row] = await db
    .insert(tourVersions)
    .values({ id: tourVersionId(), tourId: tour.id, projectId: tour.projectId, version: 0, status: "draft", settings: defaultSettings() })
    .onConflictDoNothing()
    .returning();
  return row ?? (await draftVersion(tour.id))!;
}

export async function listTourVersions(id: string, projectId: string): Promise<TourVersionItem[] | null> {
  const tour = await ownedTour(id, projectId);
  if (!tour) return null;
  const rows = await db
    .select({
      id: tourVersions.id,
      version: tourVersions.version,
      status: tourVersions.status,
      publishedAt: tourVersions.publishedAt,
      publisherName: users.name,
      publisherAvatar: users.avatarUrl,
      stepCount: sql<number>`(select count(*)::int from ${tourSteps} where ${tourSteps.versionId} = ${tourVersions.id})`,
    })
    .from(tourVersions)
    .leftJoin(users, eq(users.id, tourVersions.publishedBy))
    .where(and(eq(tourVersions.tourId, id), ne(tourVersions.version, 0)))
    .orderBy(desc(tourVersions.version));
  return rows.map((r) => ({
    id: r.id,
    version: r.version,
    status: r.status,
    publishedAt: r.publishedAt,
    publishedBy: r.publisherName ? { name: r.publisherName, avatarUrl: r.publisherAvatar } : null,
    stepCount: Number(r.stepCount),
  }));
}

export async function createTour(input: {
  workspaceId: string;
  projectId: string;
  userId: string;
  name: string;
  description?: string;
  startUrl?: string;
  targetHosts?: string[];
}): Promise<string> {
  const id = newTourId();
  const versionId = tourVersionId();
  const settings = settingsOf({ ...defaultSettings(input.startUrl ?? ""), targetHosts: input.targetHosts ?? [] });
  const steps = starterSteps();
  await db.batch([
    db.insert(tours).values({
      id,
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      name: input.name.trim().slice(0, 120),
      description: (input.description ?? "").trim().slice(0, 300),
      status: "draft",
      createdBy: input.userId,
    }),
    db.insert(tourVersions).values({ id: versionId, tourId: id, projectId: input.projectId, version: 0, status: "draft", settings }),
    db.insert(tourSteps).values(steps.map((s, i) => stepToRow(s, versionId, id, i))),
  ]);
  return id;
}

/** Salva o rascunho. Passos substituem os anteriores (delete + insert numa transação). */
export async function saveTourDraft(
  id: string,
  projectId: string,
  patch: { name?: string; description?: string; settings?: unknown; steps?: unknown },
  /** false = mudança que não afeta o que o usuário final vê (ex.: endereço de abertura do builder) */
  affectsPublished = true
): Promise<{ steps: TourStep[]; settings: TourSettings } | null> {
  const tour = await ownedTour(id, projectId);
  if (!tour) return null;
  const draft = await ensureDraft(tour);
  const settings = patch.settings !== undefined ? settingsOf(patch.settings) : settingsOf(draft.settings);
  const steps = patch.steps !== undefined ? normalizeSteps(patch.steps) : null;

  const tourPatch: Partial<TourRow> = { updatedAt: new Date() };
  if (affectsPublished) tourPatch.hasUnpublishedChanges = true;
  if (patch.name !== undefined && patch.name.trim()) tourPatch.name = patch.name.trim().slice(0, 120);
  if (patch.description !== undefined) tourPatch.description = patch.description.trim().slice(0, 300);

  const ops = [
    db.update(tours).set(tourPatch).where(eq(tours.id, id)),
    db.update(tourVersions).set({ settings }).where(eq(tourVersions.id, draft.id)),
  ] as const;
  if (steps) {
    const del = db.delete(tourSteps).where(eq(tourSteps.versionId, draft.id));
    if (steps.length) {
      await db.batch([...ops, del, db.insert(tourSteps).values(steps.map((s, i) => stepToRow(s, draft.id, id, i)))]);
    } else {
      await db.batch([...ops, del]);
    }
  } else {
    await db.batch(ops);
  }
  return { steps: steps ?? (await stepsOf(draft.id)), settings };
}

/** Adiciona um passo ao fim do rascunho (overlay do builder no produto). */
export async function appendDraftStep(id: string, projectId: string, rawStep: unknown): Promise<TourStep | null> {
  const tour = await ownedTour(id, projectId);
  if (!tour) return null;
  const draft = await ensureDraft(tour);
  const step = normalizeStep(rawStep);
  const steps = await stepsOf(draft.id);
  // antes do passo de conclusão, se o tour termina num modal (o padrão de tours novos)
  const last = steps[steps.length - 1];
  const insertAt = steps.length > 1 && last?.type === "modal" ? steps.length - 1 : steps.length;
  const next = [...steps.slice(0, insertAt), step, ...steps.slice(insertAt)];
  await saveTourDraft(id, projectId, { steps: next });
  return step;
}

/** Troca o alvo (e a rota) de um passo existente do rascunho. */
export async function retargetDraftStep(
  id: string,
  projectId: string,
  stepKey: string,
  rawTarget: unknown,
  rawRoute: unknown
): Promise<TourStep | null> {
  const tour = await ownedTour(id, projectId);
  if (!tour) return null;
  const draft = await ensureDraft(tour);
  const target = normalizeTarget(rawTarget);
  if (!target) return null;
  const steps = await stepsOf(draft.id);
  const idx = steps.findIndex((s) => s.key === stepKey);
  if (idx < 0) return null;
  const step: TourStep = {
    ...steps[idx],
    // um modal que ganha alvo vira tooltip (modal não aponta para nada)
    type: steps[idx].type === "modal" ? "tooltip" : steps[idx].type,
    placement: steps[idx].type === "modal" ? "auto" : steps[idx].placement,
    target,
    route: normalizeRoute(rawRoute) ?? steps[idx].route,
  };
  steps[idx] = step;
  await saveTourDraft(id, projectId, { steps });
  return step;
}

/**
 * Publica: copia o rascunho para uma versão nova. A versão anterior vira "superseded" e o
 * tour passa a apontar para a nova — tudo numa transação.
 */
export async function publishTour(
  id: string,
  projectId: string,
  userId: string
): Promise<{ ok: true; version: number } | { ok: false; error: string }> {
  const tour = await ownedTour(id, projectId);
  if (!tour) return { ok: false, error: "Tour não encontrado." };
  const draft = await ensureDraft(tour);
  const steps = await stepsOf(draft.id);
  if (!steps.some((s) => s.enabled)) return { ok: false, error: "Adicione ao menos um passo ativo antes de publicar." };
  const missing = steps.find((s) => s.enabled && s.type !== "modal" && !s.target);
  if (missing) {
    return { ok: false, error: `O passo "${missing.title || "sem título"}" precisa de um elemento alvo (ou vire um modal).` };
  }

  const [{ n }] = await db
    .select({ n: max(tourVersions.version) })
    .from(tourVersions)
    .where(eq(tourVersions.tourId, id));
  const version = (n ?? 0) + 1;
  const versionId = tourVersionId();
  const now = new Date();

  await db.batch([
    db
      .update(tourVersions)
      .set({ status: "superseded" })
      .where(and(eq(tourVersions.tourId, id), eq(tourVersions.status, "published"))),
    db.insert(tourVersions).values({
      id: versionId,
      tourId: id,
      projectId,
      version,
      status: "published",
      settings: settingsOf(draft.settings),
      publishedAt: now,
      publishedBy: userId,
    }),
    db.insert(tourSteps).values(steps.map((s, i) => stepToRow(s, versionId, id, i))),
    db
      .update(tours)
      .set({ status: "published", publishedVersionId: versionId, hasUnpublishedChanges: false, updatedAt: now })
      .where(eq(tours.id, id)),
  ]);
  return { ok: true, version };
}

/** Rollback: traz uma versão publicada de volta para o rascunho (publicar em seguida a coloca no ar). */
export async function restoreTourVersion(id: string, projectId: string, versionId: string): Promise<boolean> {
  const tour = await ownedTour(id, projectId);
  if (!tour) return false;
  const [source] = await db
    .select()
    .from(tourVersions)
    .where(and(eq(tourVersions.id, versionId), eq(tourVersions.tourId, id)))
    .limit(1);
  if (!source) return false;
  const steps = await stepsOf(source.id);
  await saveTourDraft(id, projectId, { steps, settings: source.settings });
  return true;
}

/** Arquivar tira o tour do ar sem perder versões; reativar volta à versão publicada. */
export async function setTourStatus(id: string, projectId: string, status: "archived" | "active"): Promise<boolean> {
  const tour = await ownedTour(id, projectId);
  if (!tour) return false;
  const next: TourStatus = status === "archived" ? "archived" : tour.publishedVersionId ? "published" : "draft";
  await db.update(tours).set({ status: next, updatedAt: new Date() }).where(eq(tours.id, id));
  return true;
}

export async function duplicateTour(id: string, projectId: string, userId: string): Promise<string | null> {
  const tour = await ownedTour(id, projectId);
  if (!tour) return null;
  const draft = await ensureDraft(tour);
  const steps = await stepsOf(draft.id);
  const newId = newTourId();
  const versionId = tourVersionId();
  const insertTour = db.insert(tours).values({
    id: newId,
    workspaceId: tour.workspaceId,
    projectId,
    name: `${tour.name} (cópia)`.slice(0, 120),
    description: tour.description,
    status: "draft",
    createdBy: userId,
  });
  const insertVersion = db
    .insert(tourVersions)
    .values({ id: versionId, tourId: newId, projectId, version: 0, status: "draft", settings: settingsOf(draft.settings) });
  if (steps.length) {
    await db.batch([
      insertTour,
      insertVersion,
      db.insert(tourSteps).values(steps.map((s, i) => stepToRow(s, versionId, newId, i))),
    ]);
  } else {
    await db.batch([insertTour, insertVersion]);
  }
  return newId;
}

export async function deleteTour(id: string, projectId: string): Promise<boolean> {
  const tour = await ownedTour(id, projectId);
  if (!tour) return false;
  await db.delete(tours).where(eq(tours.id, id));
  return true;
}

/** Nome do tour (para a barra do builder e os links de preview), com posse verificada. */
export async function getTourName(id: string, projectId: string): Promise<string | null> {
  return (await ownedTour(id, projectId))?.name ?? null;
}

/* ---------- SDK ---------- */

/**
 * Tours publicados que valem para a plataforma, no formato enxuto do /config (sem passos).
 * Mesma regra de plataforma das pesquisas: sem `targetHosts` = todas; sem `host` (SDK antigo)
 * só os sem alvo.
 */
export async function listPublishedToursForSdk(projectId: string, host: string): Promise<TourCatalogEntry[]> {
  const rows = await db
    .select({ id: tours.id, version: tourVersions.version, settings: tourVersions.settings })
    .from(tours)
    .innerJoin(tourVersions, eq(tourVersions.id, tours.publishedVersionId))
    .where(and(eq(tours.projectId, projectId), eq(tours.status, "published")));
  return rows
    .map((r) => ({ id: r.id, v: r.version, settings: settingsOf(r.settings) }))
    .filter((r) => r.settings.targetHosts.length === 0 || (!!host && r.settings.targetHosts.includes(host)))
    .map((r) => ({
      id: r.id,
      v: r.v,
      trigger: r.settings.trigger,
      frequency: r.settings.frequency,
      audience: r.settings.audience,
    }));
}

async function payloadFor(tour: TourRow, versionId: string): Promise<TourPayload | null> {
  const [version] = await db.select().from(tourVersions).where(eq(tourVersions.id, versionId)).limit(1);
  if (!version) return null;
  const steps = await stepsOf(version.id);
  return { id: tour.id, v: version.version, versionId: version.id, name: tour.name, settings: settingsOf(version.settings), steps };
}

/** Versão publicada (o que usuários finais executam). null se não publicado ou arquivado. */
export async function getPublishedTourPayload(id: string, projectId: string): Promise<TourPayload | null> {
  const tour = await ownedTour(id, projectId);
  if (!tour || tour.status !== "published" || !tour.publishedVersionId) return null;
  return payloadFor(tour, tour.publishedVersionId);
}

/** Rascunho, para preview no produto (token de preview). */
export async function getDraftTourPayload(id: string, projectId: string): Promise<TourPayload | null> {
  const tour = await ownedTour(id, projectId);
  if (!tour) return null;
  const draft = await ensureDraft(tour);
  return payloadFor(tour, draft.id);
}

/** Resumo do rascunho para a barra do builder no produto. */
export async function getBuilderSession(id: string, projectId: string) {
  const tour = await ownedTour(id, projectId);
  if (!tour) return null;
  const draft = await ensureDraft(tour);
  const steps = await stepsOf(draft.id);
  return {
    id: tour.id,
    name: tour.name,
    steps: steps.map((s) => ({ key: s.key, type: s.type, title: s.title, route: s.route, hasTarget: !!s.target })),
  };
}

export type { ElementTarget };
