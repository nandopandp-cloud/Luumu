import "server-only";
import { and, asc, count, desc, eq, avg } from "drizzle-orm";
import { db } from "./client";
import { surveys, questions, responses } from "@/db/schema";
import { surveyId, questionId } from "./ids";
import { questionTemplates } from "@/lib/survey-templates";
import { defaultAppearanceFor, type Appearance } from "@/lib/builder";
import type { SurveyType, SurveyStatus } from "@/lib/mock/surveys";

export type SurveyRow = typeof surveys.$inferSelect;
export type QuestionRow = typeof questions.$inferSelect;

/** Lista de pesquisas do workspace com métricas derivadas (nº respostas + score médio). */
export async function listSurveys(workspaceId: string) {
  const rows = await db
    .select()
    .from(surveys)
    .where(eq(surveys.workspaceId, workspaceId))
    .orderBy(desc(surveys.updatedAt));

  const withStats = await Promise.all(
    rows.map(async (s) => {
      const [{ n } = { n: 0 }] = await db
        .select({ n: count() })
        .from(responses)
        .where(eq(responses.surveyId, s.id));
      const [{ avgScore } = { avgScore: null }] = await db
        .select({ avgScore: avg(responses.score) })
        .from(responses)
        .where(eq(responses.surveyId, s.id));
      return {
        ...s,
        responseCount: Number(n) || 0,
        score: avgScore != null ? Math.round(Number(avgScore) * 10) / 10 : null,
      };
    })
  );
  return withStats;
}

/**
 * Busca uma pesquisa. Se `workspaceId` for informado, exige que pertença ao tenant
 * (retorna null caso contrário) — usado no painel. A API pública passa o workspace da key.
 */
export async function getSurvey(id: string, workspaceId?: string) {
  const [s] = await db.select().from(surveys).where(eq(surveys.id, id)).limit(1);
  if (!s) return null;
  if (workspaceId && s.workspaceId !== workspaceId) return null;
  return s;
}

export async function getSurveyWithQuestions(id: string, workspaceId?: string) {
  const s = await getSurvey(id, workspaceId);
  if (!s) return null;
  const qs = await db
    .select()
    .from(questions)
    .where(eq(questions.surveyId, id))
    .orderBy(asc(questions.order));
  return { survey: s, questions: qs };
}

/** Garante que a pesquisa pertence ao workspace; lança se não. */
async function assertOwned(id: string, workspaceId: string) {
  const s = await getSurvey(id);
  if (!s || s.workspaceId !== workspaceId) {
    throw new Error("Pesquisa não encontrada neste workspace.");
  }
  return s;
}

/** Cria uma pesquisa a partir de um template de tipo, com perguntas-semente. */
export async function createSurveyFromTemplate(workspaceId: string, type: SurveyType) {
  const tpl = questionTemplates[type] ?? questionTemplates.Personalizada;
  const id = surveyId();
  await db.insert(surveys).values({
    id,
    workspaceId,
    name: tpl.name,
    type,
    status: "rascunho",
    appearance: defaultAppearanceFor(type),
  });
  if (tpl.questions.length) {
    await db.insert(questions).values(
      tpl.questions.map((q, i) => ({
        id: questionId(),
        surveyId: id,
        order: i,
        blockId: q.blockId,
        title: q.title,
        required: q.required,
        config: q.config ?? {},
        logic: q.logic ?? {},
      }))
    );
  }
  return id;
}

export async function updateSurvey(
  id: string,
  workspaceId: string,
  patch: Partial<Pick<SurveyRow, "name" | "channel" | "audience" | "segment" | "language" | "trigger" | "frequency" | "delay" | "startsAt" | "endsAt">>
) {
  await assertOwned(id, workspaceId);
  await db.update(surveys).set({ ...patch, updatedAt: new Date() }).where(eq(surveys.id, id));
}

/** Substitui todas as perguntas da pesquisa (usado ao salvar o builder). */
export async function replaceQuestions(
  id: string,
  workspaceId: string,
  qs: { blockId: string; title: string; required: boolean; config?: unknown; logic?: unknown }[]
) {
  await assertOwned(id, workspaceId);
  await db.delete(questions).where(eq(questions.surveyId, id));
  if (qs.length) {
    await db.insert(questions).values(
      qs.map((q, i) => ({
        id: questionId(),
        surveyId: id,
        order: i,
        blockId: q.blockId,
        title: q.title,
        required: q.required,
        config: (q.config as object) ?? {},
        logic: (q.logic as object) ?? {},
      }))
    );
  }
  await db.update(surveys).set({ updatedAt: new Date() }).where(eq(surveys.id, id));
}

export async function publishSurvey(id: string, workspaceId: string) {
  await assertOwned(id, workspaceId);
  await db
    .update(surveys)
    .set({ status: "ativa", publishedAt: new Date(), updatedAt: new Date() })
    .where(eq(surveys.id, id));
}

export async function setSurveyStatus(id: string, workspaceId: string, status: SurveyStatus) {
  await assertOwned(id, workspaceId);
  await db.update(surveys).set({ status, updatedAt: new Date() }).where(eq(surveys.id, id));
}

export async function deleteSurvey(id: string, workspaceId: string) {
  await assertOwned(id, workspaceId);
  await db.delete(surveys).where(eq(surveys.id, id));
}

/** Salva a aparência do widget embutido. */
export async function saveAppearance(id: string, workspaceId: string, appearance: Appearance) {
  await assertOwned(id, workspaceId);
  await db.update(surveys).set({ appearance, updatedAt: new Date() }).where(eq(surveys.id, id));
}

/** Pesquisas ativas de um workspace (para a API pública do SDK). */
export async function listActiveSurveys(workspaceId: string) {
  return db
    .select()
    .from(surveys)
    .where(and(eq(surveys.workspaceId, workspaceId), eq(surveys.status, "ativa")))
    .orderBy(desc(surveys.publishedAt));
}
