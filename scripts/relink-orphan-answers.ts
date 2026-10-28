/**
 * Religa answers órfãs às perguntas atuais da pesquisa. Até o fix do replaceQuestions, cada save
 * do builder recriava as perguntas com ids novos, e as answers já gravadas ficavam apontando para
 * ids que não existem mais (sem título no detalhe, fora da análise por pergunta).
 *
 * Como casa: as answers de uma resposta são gravadas num único INSERT, na ordem das perguntas,
 * então a ordem física (ctid) reproduz a ordem da pesquisa. Uma resposta só "vota" quando tem
 * exatamente uma answer por pergunta atual, cada answer tem o formato do bloco daquela posição
 * (`score` em nota, `text` em texto, `value` nos demais) e as answers que já apontam para
 * perguntas atuais estão na posição certa. Um id órfão só é religado se todos os votos dele
 * concordam. Idempotente.
 *
 *   pnpm exec tsx --tsconfig scripts/tsconfig.scripts.json scripts/relink-orphan-answers.ts          # simula
 *   pnpm exec tsx --tsconfig scripts/tsconfig.scripts.json scripts/relink-orphan-answers.ts --apply  # aplica
 */
import "./support/env";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { answers, questions, responses, surveys } from "@/lib/db/schema";
import { blockKind, scoreBlocks } from "@/lib/surveys/builder";

const APPLY = process.argv.includes("--apply");

/** Formato que o bloco grava (o mesmo do normalize do widget e da página pública). */
function shapeOf(blockId: string): "score" | "text" | "value" {
  if (scoreBlocks.has(blockId)) return "score";
  if (blockKind[blockId] === "text") return "text";
  return "value";
}

function fits(value: unknown, shape: "score" | "text" | "value"): boolean {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  // {} = pergunta pulada (normalize de valor vazio); não diz nada contra a posição
  return keys.length === 0 || keys.includes(shape);
}

async function main() {
  const affected = await db.execute<{ survey_id: string; name: string }>(sql`
    select distinct s.id as survey_id, s.name
      from ${answers} a
      join ${responses} r on r.id = a.response_id
      join ${surveys} s on s.id = r.survey_id
      left join ${questions} q on q.id = a.question_id
     where q.id is null`);
  const list = (affected as unknown as { rows?: { survey_id: string; name: string }[] }).rows ?? (affected as unknown as { survey_id: string; name: string }[]);

  let totalRelinked = 0;
  for (const { survey_id: surveyId, name } of list) {
    const qs = await db
      .select({ id: questions.id, blockId: questions.blockId })
      .from(questions)
      .where(eq(questions.surveyId, surveyId))
      .orderBy(asc(questions.order));
    const current = new Set(qs.map((q) => q.id));

    const res = await db.execute<{ response_id: string; qids: string[]; vals: unknown[] }>(sql`
      select a.response_id, array_agg(a.question_id order by a.ctid) as qids, array_agg(a.value order by a.ctid) as vals
        from ${answers} a join ${responses} r on r.id = a.response_id
       where r.survey_id = ${surveyId}
       group by a.response_id`);
    const rows = (res as unknown as { rows?: { response_id: string; qids: string[]; vals: unknown[] }[] }).rows ?? (res as unknown as { response_id: string; qids: string[]; vals: unknown[] }[]);

    // votos: id órfão -> { pergunta atual -> nº de respostas que apontam para ela }
    const votes = new Map<string, Map<string, number>>();
    const orphanIds = new Set<string>();
    let voters = 0;
    for (const r of rows) {
      for (const id of r.qids) if (!current.has(id)) orphanIds.add(id);
      if (r.qids.length !== qs.length) continue;
      const ok = r.qids.every((id, i) => (current.has(id) ? id === qs[i].id : true) && fits(r.vals[i], shapeOf(qs[i].blockId)));
      if (!ok) continue;
      voters++;
      r.qids.forEach((id, i) => {
        if (current.has(id)) return;
        const v = votes.get(id) ?? new Map<string, number>();
        v.set(qs[i].id, (v.get(qs[i].id) ?? 0) + 1);
        votes.set(id, v);
      });
    }

    const mapping = new Map<string, string>();
    for (const [orphan, v] of votes) if (v.size === 1) mapping.set(orphan, [...v.keys()][0]);
    // duas famílias de ids órfãos não podem cair na mesma resposta + pergunta
    const unmapped = [...orphanIds].filter((id) => !mapping.has(id));

    const counts = mapping.size
      ? await db
          .select({ qid: answers.questionId, n: sql<number>`count(*)`.mapWith(Number) })
          .from(answers)
          .innerJoin(responses, eq(responses.id, answers.responseId))
          .where(and(eq(responses.surveyId, surveyId), inArray(answers.questionId, [...mapping.keys()])))
          .groupBy(answers.questionId)
      : [];
    const relinkable = counts.reduce((s, c) => s + c.n, 0);
    totalRelinked += relinkable;

    console.log(
      `${surveyId} · ${name}\n  respostas: ${rows.length} (votantes: ${voters}) · ids órfãos: ${orphanIds.size} · religáveis: ${mapping.size} (${relinkable} answers)` +
        (unmapped.length ? ` · sem casamento seguro: ${unmapped.length}` : "")
    );

    if (APPLY && mapping.size) {
      for (const [orphan, target] of mapping) {
        await db
          .update(answers)
          .set({ questionId: target })
          .where(
            and(
              eq(answers.questionId, orphan),
              inArray(answers.responseId, db.select({ id: responses.id }).from(responses).where(eq(responses.surveyId, surveyId)))
            )
          );
      }
    }
  }
  console.log(`\n${APPLY ? "Religadas" : "Seriam religadas"}: ${totalRelinked} answers.${APPLY ? "" : " Rode com --apply para gravar."}`);
}

main().then(() => process.exit(0));
