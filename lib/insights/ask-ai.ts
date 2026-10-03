import "server-only";
import { AiError, chatJSON, isAiConfigured } from "@/lib/ai/llm";
import { answerQuestion } from "./ask";
import { ANSWER_SCHEMA, buildContext, parseAnswer, SYSTEM_PROMPT } from "./ai-context";
import type { InsightAnswer, InsightsData } from "./types";

/*
  Quem responde "Pergunte algo sobre seus dados":
   1. a IA (Groq), com os dados da página e comentários anonimizados;
   2. se a IA não estiver configurada, estourar a cota ou falhar → as regras locais
      (lib/insights/ask.ts), que respondem com os mesmos números. A tela nunca fica sem resposta.
*/

export async function askInsights(question: string, data: InsightsData): Promise<InsightAnswer> {
  if (!isAiConfigured() || data.totalResponses === 0) return answerQuestion(question, data);
  try {
    const raw = await chatJSON({
      system: SYSTEM_PROMPT,
      user: `DADOS:\n${buildContext(data)}\n\nPERGUNTA DO USUÁRIO: ${question.slice(0, 500)}`,
      schema: ANSWER_SCHEMA,
      maxTokens: 900,
    });
    return parseAnswer(question, raw) ?? answerQuestion(question, data);
  } catch (e) {
    if (e instanceof AiError) console.warn(`[insights] IA indisponível (${e.kind}): ${e.message}`);
    return answerQuestion(question, data);
  }
}
