import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { customAlphabet } from "nanoid";
import * as schema from "./schema";
import { workspaces, surveys, questions, responses, answers } from "./schema";
import { surveys as mockSurveys } from "../lib/mock/surveys";
import { responses as mockResponses } from "../lib/mock/responses";
import { questionTemplates } from "../lib/survey-templates";
import { defaultAppearanceFor } from "../lib/builder";
import type { SurveyType } from "../lib/mock/surveys";

const nano = customAlphabet("23456789abcdefghijkmnpqrstuvwxyz", 10);
const id = (p: string) => `${p}_${nano()}`;

const sql = neon(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

const WORKSPACE_ID = "ws_luumu";

async function main() {
  console.log("🌱 Seed iniciando…");

  // limpa (idempotente)
  await db.delete(answers);
  await db.delete(responses);
  await db.delete(questions);
  await db.delete(surveys);
  await db.delete(workspaces);

  // workspace
  await db.insert(workspaces).values({
    id: WORKSPACE_ID,
    name: "Jovens Gênios",
    slug: "jovensgenios",
    plan: "growth",
  });

  // pesquisas (mantém os ids do mock p/ continuidade de links) + perguntas por tipo
  for (const s of mockSurveys) {
    const status = s.status;
    await db.insert(surveys).values({
      id: s.id,
      workspaceId: WORKSPACE_ID,
      name: s.name,
      type: s.type,
      status,
      channel: s.channel,
      appearance: defaultAppearanceFor(s.type as SurveyType),
      publishedAt: status === "ativa" || status === "pausada" || status === "encerrada" ? new Date() : null,
    });

    const tpl = questionTemplates[s.type as SurveyType] ?? questionTemplates.Personalizada;
    if (tpl.questions.length) {
      await db.insert(questions).values(
        tpl.questions.map((q, i) => ({
          id: id("qst"),
          surveyId: s.id,
          order: i,
          blockId: q.blockId,
          title: q.title,
          required: q.required,
          config: q.config ?? {},
          logic: q.logic ?? {},
        }))
      );
    }
  }

  // respostas de exemplo vão para a pesquisa CSAT · Produto (csat-produto)
  const target = "csat-produto";
  const targetQs = await db.select().from(questions).where(eqSurvey(target));
  const scoreQ = targetQs.find((q) => ["csat", "nps", "ces", "scale", "stars"].includes(q.blockId));
  const textQ = targetQs.find((q) => ["long", "short"].includes(q.blockId));

  for (const r of mockResponses) {
    const rid = id("res");
    await db.insert(responses).values({
      id: rid,
      surveyId: target,
      respondent: r.user,
      channel: r.channel,
      sentiment: r.sentiment,
      score: r.score,
    });
    const rowAnswers = [];
    if (scoreQ) rowAnswers.push({ id: id("ans"), responseId: rid, questionId: scoreQ.id, value: { score: r.score } });
    if (textQ) rowAnswers.push({ id: id("ans"), responseId: rid, questionId: textQ.id, value: { text: r.comment } });
    if (rowAnswers.length) await db.insert(answers).values(rowAnswers);
  }

  const [{ c: sc }] = await sql`SELECT count(*)::int as c FROM surveys`;
  const [{ c: qc }] = await sql`SELECT count(*)::int as c FROM questions`;
  const [{ c: rc }] = await sql`SELECT count(*)::int as c FROM responses`;
  console.log(`✅ Seed concluído: ${sc} pesquisas, ${qc} perguntas, ${rc} respostas.`);
}

// helper local (evita import circular do data-layer server-only)
import { eq } from "drizzle-orm";
function eqSurvey(surveyId: string) {
  return eq(questions.surveyId, surveyId);
}

main().catch((e) => {
  console.error("❌ Seed falhou:", e);
  process.exit(1);
});
