"use server";

import { z } from "zod";
import { getCurrentProjectId, requireUser } from "@/lib/auth/current";
import { checkRateLimit } from "@/lib/api/ratelimit";
import { normalizeHost } from "@/lib/hosts";
import { getInsights } from "@/lib/insights/service";
import { askInsights } from "@/lib/insights/ask-ai";
import { fold } from "@/lib/insights/themes";
import type { InsightAnswer } from "@/lib/insights/types";

const schema = z.object({
  question: z.string().trim().min(1).max(500),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) }))
    .max(20)
    .default([]),
  filters: z
    .object({
      period: z.string().max(10).optional(),
      from: z.string().max(10).optional(),
      to: z.string().max(10).optional(),
      surveyId: z.string().max(40).optional(),
      host: z.string().max(253).optional(),
    })
    .default({}),
});

/*
  Respostas recentes por (projeto, filtros, pergunta): perguntas repetidas — inclusive as
  sugeridas, que todo mundo clica — não gastam a cota grátis do provedor de novo.
*/
const CACHE_TTL_MS = 10 * 60_000;
const cache = new Map<string, { at: number; answer: InsightAnswer }>();

export async function askInsightsAction(input: unknown): Promise<InsightAnswer | { error: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Escreva uma pergunta um pouco maior." };
  const [user, projectId] = await Promise.all([requireUser(), getCurrentProjectId()]);
  const { question, filters, history } = parsed.data;

  // só a primeira pergunta de uma conversa é reaproveitável: com histórico, o contexto muda
  const key = history.length ? null : `${projectId}|${JSON.stringify(filters)}|${fold(question)}`;
  const hit = key ? cache.get(key) : undefined;
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.answer;

  // a cota grátis é do workspace inteiro: cada pessoa tem um teto para não esgotá-la sozinha
  const [perMinute, perDay] = await Promise.all([
    checkRateLimit(`ai-min:${user.userId}`, 8, 60),
    checkRateLimit(`ai-day:${user.userId}`, 60, 86_400),
  ]);
  if (!perMinute || !perDay) {
    return { error: perMinute ? "Você atingiu o limite de perguntas de hoje. Volte amanhã." : "Muitas perguntas seguidas. Aguarde um minuto." };
  }

  // os dados vêm do servidor (nunca do navegador): a IA só vê o que o filtro e o escopo permitem
  const data = await getInsights({
    projectId,
    surveyId: filters.surveyId && filters.surveyId !== "all" ? filters.surveyId : undefined,
    host: normalizeHost(filters.host) || undefined,
    period: filters.period,
    from: filters.from,
    to: filters.to,
  });
  const answer = await askInsights(question, data, history);

  if (key) {
    if (cache.size > 500) cache.delete(cache.keys().next().value!);
    cache.set(key, { at: Date.now(), answer });
  }
  return answer;
}
