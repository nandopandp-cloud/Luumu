import "server-only";
import { and, eq, gte, inArray, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "./client";
import { surveyViews, surveys } from "@/db/schema";
import { hostList } from "@/lib/hosts";
import { fillDays } from "@/lib/period";
import { previousScope } from "./overview";
import type { Scope } from "./responses";

/*
  Exibições do widget (SDK) e a conversão delas em resposta. Respostas pelo link público
  não passam por aqui: o indicador mede quem VIU a pesquisa no produto e não respondeu.
*/

/** Registra uma exibição. Idempotente: o id vem do navegador e um reenvio não duplica. */
export async function recordSurveyView(input: {
  id: string;
  surveyId: string;
  host: string | null;
  device: string | null;
  respondent: string | null;
}) {
  await db.insert(surveyViews).values(input).onConflictDoNothing({ target: surveyViews.id });
}

/** Marca a exibição como respondida (a resposta chegou com o id dela). */
export async function markViewResponded(viewId: string, surveyId: string) {
  await db
    .update(surveyViews)
    .set({ respondedAt: new Date() })
    .where(and(eq(surveyViews.id, viewId), eq(surveyViews.surveyId, surveyId), isNull(surveyViews.respondedAt)));
}

/** Mesmo recorte de scopeWhere (responses.ts), aplicado à data/plataforma da exibição. */
function viewsWhere(scope: Scope): SQL | undefined {
  const parts = [eq(surveys.projectId, scope.projectId)];
  if (scope.surveyId) parts.push(eq(surveyViews.surveyId, scope.surveyId));
  if (scope.surveyType) parts.push(eq(surveys.type, scope.surveyType));
  if (scope.dateFrom) parts.push(gte(surveyViews.createdAt, scope.dateFrom));
  if (scope.dateTo) parts.push(lte(surveyViews.createdAt, scope.dateTo));
  const hosts = hostList(scope.host);
  if (hosts.length) {
    parts.push(
      or(
        inArray(surveyViews.host, hosts),
        and(isNull(surveyViews.host), sql`(${sql.join(hosts.map((h) => sql`${surveys.targetHosts} @> ${JSON.stringify([h])}::jsonb`), sql` or `)})`)
      )!
    );
  }
  return and(...parts);
}

export interface ViewFunnel {
  viewed: number;
  notResponded: number;
  /** % das exibições sem resposta (0–100); null sem exibições */
  notRespondedPct: number | null;
}

export interface ViewDailyPoint {
  date: string;
  viewed: number;
  notResponded: number;
}

async function funnel(scope: Scope): Promise<ViewFunnel> {
  const [row] = await db
    .select({
      viewed: sql<number>`count(*)::int`,
      notResponded: sql<number>`count(*) filter (where ${surveyViews.respondedAt} is null)::int`,
    })
    .from(surveyViews)
    .innerJoin(surveys, eq(surveyViews.surveyId, surveys.id))
    .where(viewsWhere(scope));
  const viewed = Number(row?.viewed ?? 0);
  const notResponded = Number(row?.notResponded ?? 0);
  return { viewed, notResponded, notRespondedPct: viewed ? Math.round((notResponded / viewed) * 1000) / 10 : null };
}

async function daily(scope: Scope): Promise<ViewDailyPoint[]> {
  const day = sql<string>`to_char(date_trunc('day', ${surveyViews.createdAt}), 'YYYY-MM-DD')`;
  const rows = await db
    .select({
      date: day,
      viewed: sql<number>`count(*)::int`,
      notResponded: sql<number>`count(*) filter (where ${surveyViews.respondedAt} is null)::int`,
    })
    .from(surveyViews)
    .innerJoin(surveys, eq(surveyViews.surveyId, surveys.id))
    .where(viewsWhere(scope))
    .groupBy(sql`1`)
    .orderBy(sql`1`);
  return rows.map((r) => ({ date: r.date, viewed: Number(r.viewed), notResponded: Number(r.notResponded) }));
}

/** Exibições × respostas do recorte, o período anterior (comparativo) e a série diária. */
export async function getViewOverview(scope: Scope) {
  const prev = previousScope(scope);
  const [current, prevFunnel, series] = await Promise.all([funnel(scope), prev ? funnel(prev) : Promise.resolve(null), daily(scope)]);
  return {
    ...current,
    prev: prevFunnel,
    daily: fillDays(series, (date) => ({ date, viewed: 0, notResponded: 0 }), scope.dateFrom, scope.dateTo, 60),
  };
}
