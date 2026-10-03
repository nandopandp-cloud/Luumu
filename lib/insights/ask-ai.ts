import "server-only";
import { AiError, chatJSON, isAiConfigured } from "@/lib/ai/llm";
import { answerQuestion } from "./ask";
import { ANSWER_SCHEMA, buildContext, formatHistory, parseAnswer, SYSTEM_PROMPT } from "./ai-context";
import type { ChatTurn, InsightAnswer, InsightsData } from "./types";

/*
  Quem responde "Pergunte algo sobre seus dados":
   1. a IA (Groq), com os dados da página e comentários anonimizados;
   2. se a IA não estiver configurada, estourar a cota ou falhar → as regras locais
      (lib/insights/ask.ts), que respondem com os mesmos números. A tela nunca fica sem resposta.
*/

export async function askInsights(question: string, data: InsightsData, history: ChatTurn[] = []): Promise<InsightAnswer> {
  if (!isAiConfigured() || data.totalResponses === 0) return answerQuestion(question, data, history);
  const past = formatHistory(history);
  try {
    const raw = await chatJSON({
      system: SYSTEM_PROMPT,
      user: `DADOS:\n${buildContext(data)}\n\n${past ? `HISTÓRICO DA CONVERSA:\n${past}\n\n` : ""}PERGUNTA DO USUÁRIO: ${question.slice(0, 500)}`,
      schema: ANSWER_SCHEMA,
      maxTokens: 1100,
    });
    return parseAnswer(question, raw) ?? answerQuestion(question, data, history);
  } catch (e) {
    if (e instanceof AiError) console.warn(`[insights] IA indisponível (${e.kind}): ${e.message}`);
    return answerQuestion(question, data, history);
  }
}
