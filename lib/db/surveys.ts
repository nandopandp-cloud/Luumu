import "server-only";
import { and, asc, count, desc, eq, avg, inArray } from "drizzle-orm";
import { db } from "./client";
import { surveys, questions, responses } from "@/db/schema";
import { surveyId, questionId } from "./ids";
import { questionTemplates } from "@/lib/survey-templates";
import { defaultAppearanceFor, type Appearance } from "@/lib/builder";
import type { SurveyType, SurveyStatus } from "@/lib/mock/surveys";

export type SurveyRow = typeof surveys.$inferSelect;
export type QuestionRow = typeof questions.$inferSelect;

/** Lista leve (id + nome) das pesquisas do projeto — usada para popular seletores/filtros. */
export async function listSurveyOptions(projectId: string) {
  return db
    .select({ id: surveys.id, name: surveys.name })
    .from(surveys)
    .where(eq(surveys.projectId, projectId))
    .orderBy(desc(surveys.updatedAt));
}

/**
 * Lista de pesquisas do projeto com métricas derivadas (nº respostas + score médio).
 * Busca os agregados de todas as surveys em 1 query (GROUP BY) em vez de 2 queries por
 * survey — cada query é um round-trip HTTP completo ao Neon, então um projeto com muitas
 * pesquisas tornava essa função (usada em /surveys e no dashboard) visivelmente lenta.
 */
export async function listSurveys(projectId: string) {
  const rows = await db
    .select()
    .from(surveys)
    .where(eq(surveys.projectId, projectId))
    .orderBy(desc(surveys.updatedAt));

  if (rows.length === 0) return [];

  const stats = await db
    .select({ surveyId: responses.surveyId, n: count(), avgScore: avg(responses.score) })
    .from(responses)
    .where(inArray(responses.surveyId, rows.map((s) => s.id)))
    .groupBy(responses.surveyId);

  const statsBySurvey = new Map(stats.map((s) => [s.surveyId, s]));

  return rows.map((s) => {
    const stat = statsBySurvey.get(s.id);
    return {
      ...s,
      responseCount: Number(stat?.n) || 0,
      score: stat?.avgScore != null ? Math.round(Number(stat.avgScore) * 10) / 10 : null,
    };
  });
}

/**
 * Busca uma pesquisa. Restringe pelo tenant/projeto informado (retorna null caso
 * a survey não pertença a ele). O painel passa workspaceId; a API pública passa
 * projectId (resolvido da SDK key).
 */
export async function getSurvey(id: string, scope?: { workspaceId?: string; projectId?: string }) {
  const [s] = await db.select().from(surveys).where(eq(surveys.id, id)).limit(1);
  if (!s) return null;
  if (scope?.workspaceId && s.workspaceId !== scope.workspaceId) return null;
  if (scope?.projectId && s.projectId !== scope.projectId) return null;
  return s;
}

/**
 * Busca a pesquisa e suas perguntas em paralelo — a query de perguntas só depende do
 * `id` (já conhecido), não do resultado de getSurvey. Se a checagem de tenant falhar,
 * o resultado de `qs` é descartado sem custo adicional (já veio junto, em paralelo).
 * Usado nas páginas mais visitadas ao editar uma pesquisa (builder/appearance/preview).
 */
export async function getSurveyWithQuestions(id: string, scope?: { workspaceId?: string; projectId?: string }) {
  const [s, qs] = await Promise.all([
    getSurvey(id, scope),
    db.select().from(questions).where(eq(questions.surveyId, id)).orderBy(asc(questions.order)),
  ]);
  if (!s) return null;
  return { survey: s, questions: qs };
}

/** Garante que a pesquisa pertence ao workspace; lança se não. */
async function assertOwned(id: string, workspaceId: string) {
  const s = await getSurvey(id, { workspaceId });
  if (!s) {
    throw new Error("Pesquisa não encontrada neste workspace.");
  }
  return s;
}

/** Cria uma pesquisa a partir de um template de tipo, com perguntas-semente. */
export async function createSurveyFromTemplate(workspaceId: string, projectId: string, type: SurveyType) {
  const tpl = questionTemplates[type] ?? questionTemplates.Personalizada;
  const id = surveyId();
  await db.insert(surveys).values({
    id,
    workspaceId,
    projectId,
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
  patch: Partial<Pick<SurveyRow, "name" | "channel" | "audience" | "segment" | "language" | "trigger" | "triggerEvent" | "triggerEvents" | "audienceMode" | "audienceList" | "frequency" | "delay" | "startsAt" | "endsAt" | "responseLimit">>
) {
  await assertOwned(id, workspaceId);
  await db.update(surveys).set({ ...patch, updatedAt: new Date() }).where(eq(surveys.id, id));
}

/**
 * Substitui todas as perguntas da pesquisa (usado ao salvar o builder).
 * O `uid` de cada pergunta é o identificador temporário gerado no client (builder);
 * como cada save gera um `id` real novo, remapeamos aqui as referências de
 * `logic.showIf.questionUid` (que apontam para o `uid` de outra pergunta do array)
 * para o `id` real correspondente, senão a lógica condicional nunca casa com as
 * respostas gravadas (que são indexadas pelo `id` real).
 */
export async function replaceQuestions(
  id: string,
  workspaceId: string,
  qs: { uid?: string; blockId: string; title: string; required: boolean; config?: unknown; logic?: unknown }[]
) {
  await assertOwned(id, workspaceId);
  await db.delete(questions).where(eq(questions.surveyId, id));
  if (qs.length) {
    const realIds = qs.map(() => questionId());
    const uidToRealId = new Map<string, string>();
    qs.forEach((q, i) => {
      if (q.uid) uidToRealId.set(q.uid, realIds[i]);
    });

    await db.insert(questions).values(
      qs.map((q, i) => {
        const logic = (q.logic as { showIf?: { questionUid?: string } }) ?? {};
        const showIf = logic.showIf;
        const remappedLogic =
          showIf?.questionUid && uidToRealId.has(showIf.questionUid)
            ? { ...logic, showIf: { ...showIf, questionUid: uidToRealId.get(showIf.questionUid) } }
            : logic;
        return {
          id: realIds[i],
          surveyId: id,
          order: i,
          blockId: q.blockId,
          title: q.title,
          required: q.required,
          config: (q.config as object) ?? {},
          logic: remappedLogic as object,
        };
      })
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

/**
 * Depois de gravar uma resposta, checa se a survey tem um limite configurado e,
 * se o total de respostas já atingiu o limite, pausa a survey automaticamente
 * (para de ser servida pelo SDK e pela página pública). Sem escopo de workspace
 * porque é chamada a partir do caminho público (SDK), não do painel autenticado.
 */
export async function enforceResponseLimit(id: string) {
  const [s] = await db.select().from(surveys).where(eq(surveys.id, id)).limit(1);
  if (!s || s.responseLimit == null || s.status !== "ativa") return;

  const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(responses).where(eq(responses.surveyId, id));
  if (n >= s.responseLimit) {
    await db.update(surveys).set({ status: "pausada", updatedAt: new Date() }).where(eq(surveys.id, id));
  }
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

/** Pesquisas ativas de um projeto (para a API pública do SDK). */
export async function listActiveSurveys(projectId: string) {
  return db
    .select()
    .from(surveys)
    .where(and(eq(surveys.projectId, projectId), eq(surveys.status, "ativa")))
    .orderBy(desc(surveys.publishedAt));
}
