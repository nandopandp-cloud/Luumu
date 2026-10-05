import { resolvePeople } from "./people";
import "server-only";
import { and, count, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "./client";
import { answers, responses, surveys, tours } from "@/db/schema";
import { commentSql } from "./response-feed";
import { likePattern, SQL_ACCENTS_FROM, SQL_ACCENTS_TO, type ResponseHit, type SurveyHit, type TourHit } from "@/lib/search/core";

/*
  Busca do ⌘K dentro do PROJETO ATIVO (o mesmo escopo de Pesquisas, Respostas e Tours, então
  todo resultado abre sem trocar de projeto). Sem acento e sem caixa dos dois lados; o termo
  do usuário é escapado e nunca vira curinga. As três buscas rodam em paralelo.
*/

const LIMITS = { surveys: 5, tours: 4, responses: 6 };

/** lower + sem acento, no banco */
const norm = (col: SQL | unknown) => sql`translate(lower(coalesce(${col}, '')), ${SQL_ACCENTS_FROM}, ${SQL_ACCENTS_TO})`;
const like = (col: SQL | unknown, pattern: string) => sql`${norm(col)} like ${pattern} escape '\\'`;

export async function searchProject(projectId: string, q: string) {
  const p = likePattern(q);

  // comentário que contém o termo (para mostrar o trecho certo); senão, o comentário principal
  const matchedComment = sql<string | null>`(
    select nullif(btrim(a.value->>'text'), '')
      from ${answers} a
     where a.response_id = ${responses.id} and ${like(sql`a.value->>'text'`, p)}
     limit 1
  )`;

  const [surveyRows, tourRows, responseRows] = await Promise.all([
    db
      .select({ id: surveys.id, name: surveys.name, type: surveys.type, status: surveys.status, updatedAt: surveys.updatedAt })
      .from(surveys)
      .where(and(eq(surveys.projectId, projectId), like(surveys.name, p)))
      // ativas primeiro, depois as mais recentes
      .orderBy(sql`(${surveys.status} = 'ativa') desc`, desc(surveys.updatedAt))
      .limit(LIMITS.surveys),
    db
      .select({ id: tours.id, name: tours.name, description: tours.description, status: tours.status, updatedAt: tours.updatedAt })
      .from(tours)
      .where(and(eq(tours.projectId, projectId), sql`(${like(tours.name, p)} or ${like(tours.description, p)})`))
      .orderBy(desc(tours.updatedAt))
      .limit(LIMITS.tours),
    db
      .select({
        id: responses.id,
        surveyId: responses.surveyId,
        surveyName: surveys.name,
        matched: matchedComment,
        comment: commentSql,
        respondent: responses.respondent,
        respondentEmail: responses.respondentEmail,
        score: responses.score,
        sentiment: responses.sentiment,
        createdAt: responses.createdAt,
      })
      .from(responses)
      .innerJoin(surveys, eq(responses.surveyId, surveys.id))
      .where(
        and(
          eq(surveys.projectId, projectId),
          sql`(${matchedComment} is not null or ${like(responses.respondent, p)} or ${like(responses.respondentEmail, p)})`
        )
      )
      .orderBy(desc(responses.createdAt))
      .limit(LIMITS.responses),
  ]);

  const ids = surveyRows.map((s) => s.id);
  const counts = ids.length
    ? await db.select({ surveyId: responses.surveyId, n: count() }).from(responses).where(inArray(responses.surveyId, ids)).groupBy(responses.surveyId)
    : [];
  const nBy = new Map(counts.map((c) => [c.surveyId, Number(c.n)]));

  const surveyHits: SurveyHit[] = surveyRows.map((s) => ({ ...s, responses: nBy.get(s.id) ?? 0, updatedAt: s.updatedAt.toISOString() }));
  const tourHits: TourHit[] = tourRows.map((t) => ({ ...t, updatedAt: t.updatedAt.toISOString() }));
  const personOf = await resolvePeople(projectId, responseRows);
  const responseHits: ResponseHit[] = responseRows.map((r) => ({
    id: r.id,
    surveyId: r.surveyId,
    surveyName: r.surveyName,
    comment: r.matched ?? r.comment,
    respondent: r.respondentEmail ?? r.respondent,
    person: personOf(r),
    score: r.score,
    sentiment: r.sentiment === "positivo" || r.sentiment === "neutro" || r.sentiment === "negativo" ? r.sentiment : null,
    createdAt: r.createdAt.toISOString(),
  }));
  return { surveys: surveyHits, tours: tourHits, responses: responseHits };
}
