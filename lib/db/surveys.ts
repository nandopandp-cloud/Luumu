import "server-only";
import { cache } from "react";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "./client";
import { surveys, questions, responses } from "@/db/schema";
import { surveyId, questionId } from "./ids";
import { questionTemplates } from "@/lib/survey-templates";
import { defaultAppearanceFor, type Appearance } from "@/lib/builder";
import { methodologyForBlock, defaultScaleForBlock, computeScore, formatScore, SCORE_BLOCK_IDS } from "@/lib/scoring";
import { today } from "@/lib/schedule";
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
 * Pesquisa que o app deve mostrar por padrão quando nenhum filtro foi escolhido
 * (dashboard, respostas, relatórios): a mais recente que ainda está no ar; se
 * nenhuma estiver ativa, a última criada. Sem isso, essas telas abriam sempre em
 * "Todas as pesquisas", que raramente é o que o usuário quer ver de cara.
 */
export async function getDefaultSurveyId(projectId: string): Promise<string | undefined> {
  const [row] = await db
    .select({ id: surveys.id })
    .from(surveys)
    .where(eq(surveys.projectId, projectId))
    // ativa primeiro, depois a mais nova
    .orderBy(sql`case when ${surveys.status} = 'ativa' then 0 else 1 end`, desc(surveys.createdAt))
    .limit(1);
  return row?.id;
}

/**
 * Lista de pesquisas do projeto com métricas derivadas (nº respostas + score na
 * metodologia correta de cada uma — NPS, CSAT e CES têm fórmulas diferentes, não é
 * uma média simples). 3 queries totais (surveys, perguntas de nota, respostas com
 * score) independente do número de pesquisas, em vez de 1 por survey.
 */
export async function listSurveys(projectId: string) {
  const rows = await db
    .select()
    .from(surveys)
    .where(eq(surveys.projectId, projectId))
    .orderBy(desc(surveys.updatedAt));

  if (rows.length === 0) return [];

  const surveyIds = rows.map((s) => s.id);
  const [scoreQuestions, scoreRows, countRows] = await Promise.all([
    db
      .select({ surveyId: questions.surveyId, blockId: questions.blockId, config: questions.config, order: questions.order })
      .from(questions)
      .where(and(inArray(questions.surveyId, surveyIds), inArray(questions.blockId, SCORE_BLOCK_IDS)))
      .orderBy(asc(questions.order)),
    db
      .select({ surveyId: responses.surveyId, score: responses.score })
      .from(responses)
      .where(and(inArray(responses.surveyId, surveyIds), sql`${responses.score} is not null`)),
    db
      .select({ surveyId: responses.surveyId, n: count() })
      .from(responses)
      .where(inArray(responses.surveyId, surveyIds))
      .groupBy(responses.surveyId),
  ]);

  // primeira pergunta de nota de cada survey (mesma regra usada na hora de gravar a resposta)
  const scoreQuestionBySurvey = new Map<string, { blockId: string; config: unknown }>();
  for (const q of scoreQuestions) {
    if (!scoreQuestionBySurvey.has(q.surveyId)) scoreQuestionBySurvey.set(q.surveyId, q);
  }

  const scoresBySurvey = new Map<string, number[]>();
  for (const r of scoreRows) {
    if (r.score == null) continue;
    const arr = scoresBySurvey.get(r.surveyId) ?? [];
    arr.push(r.score);
    scoresBySurvey.set(r.surveyId, arr);
  }

  const countBySurvey = new Map(countRows.map((c) => [c.surveyId, Number(c.n)]));

  return rows.map((s) => {
    const scoreQuestion = scoreQuestionBySurvey.get(s.id);
    const methodology = methodologyForBlock(scoreQuestion?.blockId);
    const cfg = (scoreQuestion?.config as { min?: number; max?: number }) ?? {};
    const defaults = defaultScaleForBlock(scoreQuestion?.blockId);
    const scale = { min: cfg.min ?? defaults.min, max: cfg.max ?? defaults.max };
    const result = computeScore(scoresBySurvey.get(s.id) ?? [], methodology, scale);

    return {
      ...s,
      responseCount: countBySurvey.get(s.id) ?? 0,
      score: result.value,
      scoreLabel: formatScore(result),
      scoreMethodology: result.label,
    };
  });
}

/**
 * Busca uma pesquisa. Restringe pelo tenant/projeto informado (retorna null caso
 * a survey não pertença a ele). O painel passa workspaceId; a API pública passa
 * projectId (resolvido da SDK key).
 */
/** Escopo de tenant de uma pesquisa: workspace e/ou projeto. */
export type SurveyScope = { workspaceId?: string; projectId?: string };

export async function getSurvey(id: string, scope?: SurveyScope) {
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
export async function getSurveyWithQuestions(id: string, scope?: SurveyScope) {
  const [s, qs] = await Promise.all([
    getSurvey(id, scope),
    db.select().from(questions).where(eq(questions.surveyId, id)).orderBy(asc(questions.order)),
  ]);
  if (!s) return null;
  return { survey: s, questions: qs };
}

/**
 * Mesma busca, memoizada por request (React.cache).
 *
 * A página pública `/s/[id]` resolve a pesquisa duas vezes na MESMA renderização:
 * uma em `generateMetadata` (para o <title>) e outra no componente. Sem memoização
 * isso é 4 queries por visualização em vez de 2 — na página de maior volume da
 * plataforma, e para devolver exatamente a mesma linha.
 *
 * A chave do cache inclui o escopo serializado: duas chamadas com escopos diferentes
 * são perguntas diferentes ("esta pesquisa, vista por este tenant?") e não podem
 * compartilhar resposta — senão um escopo estrito herdaria o resultado de um aberto.
 */
const getSurveyWithQuestionsMemo = cache(
  async (id: string, scopeKey: string) => {
    const scope = scopeKey ? (JSON.parse(scopeKey) as SurveyScope) : undefined;
    return getSurveyWithQuestions(id, scope);
  }
);

/** Wrapper público da versão memoizada — escopo vira chave estável do cache. */
export function getSurveyWithQuestionsCached(id: string, scope?: SurveyScope) {
  // ordem das chaves fixa: {projectId, workspaceId} e {workspaceId, projectId} são o
  // mesmo escopo e precisam gerar a mesma chave
  const scopeKey = scope
    ? JSON.stringify({ workspaceId: scope.workspaceId ?? null, projectId: scope.projectId ?? null })
    : "";
  return getSurveyWithQuestionsMemo(id, scopeKey);
}

/**
 * Garante que a pesquisa está dentro do escopo de quem chama; lança se não.
 * As chamadas autenticadas passam `{ projectId }` (o projeto ativo, já filtrado pelo
 * escopo do membro), e não apenas o workspace — assim um membro restrito ao projeto A
 * não altera por id direto uma pesquisa do projeto B, que é do mesmo workspace.
 */
async function assertOwned(id: string, scope: SurveyScope) {
  // um escopo vazio faria getSurvey aceitar qualquer pesquisa do banco; recusamos em vez
  // de degradar silenciosamente para "sem verificação de tenant"
  if (!scope.workspaceId && !scope.projectId) {
    throw new Error("Escopo obrigatório para alterar uma pesquisa.");
  }
  const s = await getSurvey(id, scope);
  if (!s) {
    throw new Error("Pesquisa não encontrada neste escopo.");
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

/**
 * Duplica uma pesquisa: copia todas as configurações (público, gatilhos, frequência,
 * aparência, limite de respostas) e as perguntas, com a vigência informada no diálogo.
 *
 * A cópia nasce sempre como rascunho e SEM respostas — respostas pertencem à pesquisa
 * original e copiá-las falsearia o score da nova. `publishedAt` também não é copiado.
 * As perguntas ganham ids novos, e as referências condicionais (`logic.showIf.questionUid`)
 * são remapeadas para os ids novos — senão a lógica da cópia continuaria apontando para
 * perguntas da pesquisa original.
 */
export async function duplicateSurvey(
  id: string,
  scope: SurveyScope,
  schedule: { name?: string; startsAt: string | null; endsAt: string | null }
) {
  const source = await assertOwned(id, scope);
  const sourceQuestions = await db
    .select()
    .from(questions)
    .where(eq(questions.surveyId, id))
    .orderBy(asc(questions.order));

  const newId = surveyId();
  await db.insert(surveys).values({
    id: newId,
    workspaceId: source.workspaceId,
    projectId: source.projectId,
    name: schedule.name?.trim() || `${source.name} (cópia)`,
    type: source.type,
    status: "rascunho",
    channel: source.channel,
    audience: source.audience,
    segment: source.segment,
    language: source.language,
    trigger: source.trigger,
    triggerEvent: source.triggerEvent,
    triggerEvents: source.triggerEvents as object,
    audienceMode: source.audienceMode,
    audienceList: source.audienceList as object,
    frequency: source.frequency,
    delay: source.delay,
    startsAt: schedule.startsAt,
    endsAt: schedule.endsAt,
    responseLimit: source.responseLimit,
    appearance: source.appearance as object,
  });

  if (sourceQuestions.length) {
    const newIds = sourceQuestions.map(() => questionId());
    const oldToNew = new Map(sourceQuestions.map((q, i) => [q.id, newIds[i]]));

    await db.insert(questions).values(
      sourceQuestions.map((q, i) => {
        const logic = (q.logic as { showIf?: { questionUid?: string } }) ?? {};
        const showIf = logic.showIf;
        const remappedLogic =
          showIf?.questionUid && oldToNew.has(showIf.questionUid)
            ? { ...logic, showIf: { ...showIf, questionUid: oldToNew.get(showIf.questionUid) } }
            : logic;
        return {
          id: newIds[i],
          surveyId: newId,
          order: q.order,
          blockId: q.blockId,
          title: q.title,
          required: q.required,
          config: (q.config as object) ?? {},
          logic: remappedLogic as object,
        };
      })
    );
  }

  return newId;
}

export async function updateSurvey(
  id: string,
  scope: SurveyScope,
  patch: Partial<Pick<SurveyRow, "name" | "type" | "channel" | "audience" | "segment" | "language" | "trigger" | "triggerEvent" | "triggerEvents" | "audienceMode" | "audienceList" | "frequency" | "delay" | "startsAt" | "endsAt" | "responseLimit">>
) {
  await assertOwned(id, scope);
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
  scope: SurveyScope,
  qs: { uid?: string; blockId: string; title: string; required: boolean; config?: unknown; logic?: unknown }[]
) {
  await assertOwned(id, scope);
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

export async function publishSurvey(id: string, scope: SurveyScope) {
  await assertOwned(id, scope);
  await db
    .update(surveys)
    .set({ status: "ativa", publishedAt: new Date(), updatedAt: new Date() })
    .where(eq(surveys.id, id));
}

export async function setSurveyStatus(id: string, scope: SurveyScope, status: SurveyStatus) {
  await assertOwned(id, scope);
  await db.update(surveys).set({ status, updatedAt: new Date() }).where(eq(surveys.id, id));
}

/**
 * Depois de gravar uma resposta, checa se a survey tem um limite configurado e,
 * se o total de respostas já atingiu o limite, tira a survey do ar automaticamente
 * (para de ser servida pelo SDK e pela página pública). Sem escopo de workspace
 * porque é chamada a partir do caminho público (SDK), não do painel autenticado.
 *
 * Se a pesquisa tem vigência definida, bater o limite dentro do período a ENCERRA:
 * a meta daquele período foi cumprida e não faz sentido ela voltar sozinha antes do
 * fim. Sem vigência, ela apenas PAUSA — o cliente pode aumentar o limite e reativar.
 */
export async function enforceResponseLimit(id: string, known?: SurveyRow) {
  /*
    `known` evita reler a pesquisa quando quem chama acabou de carregá-la — é o caso da
    ingestão de respostas do SDK, que já fez esse SELECT para validar tenant e status.

    A saída antecipada importa mais que a releitura: a maioria das pesquisas não tem
    `responseLimit`, e nesses casos o COUNT sobre `responses` (que cresce sem teto) era
    executado a cada resposta só para descobrir que não havia limite a aplicar.
  */
  const s = known ?? (await db.select().from(surveys).where(eq(surveys.id, id)).limit(1))[0];
  if (!s || s.responseLimit == null || s.status !== "ativa") return;

  const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(responses).where(eq(responses.surveyId, id));
  if (n >= s.responseLimit) {
    const scheduled = Boolean(s.startsAt || s.endsAt);
    await db
      .update(surveys)
      .set({ status: scheduled ? "encerrada" : "pausada", updatedAt: new Date() })
      .where(eq(surveys.id, id));
  }
}

export async function deleteSurvey(id: string, scope: SurveyScope) {
  await assertOwned(id, scope);
  await db.delete(surveys).where(eq(surveys.id, id));
}

/** Salva a aparência do widget embutido. */
export async function saveAppearance(id: string, scope: SurveyScope, appearance: Appearance) {
  await assertOwned(id, scope);
  await db.update(surveys).set({ appearance, updatedAt: new Date() }).where(eq(surveys.id, id));
}

/**
 * Condição SQL de vigência: `starts_at`/`ends_at` são datas civis "YYYY-MM-DD" e a
 * janela é inclusiva nas duas pontas. Datas nulas significam "sem limite daquele lado".
 * A comparação é textual contra o hoje civil do fuso do workspace (ver lib/schedule.ts).
 */
function withinScheduleSql(ref: string) {
  return and(
    sql`(${surveys.startsAt} is null or ${surveys.startsAt} = '' or ${surveys.startsAt} <= ${ref})`,
    sql`(${surveys.endsAt} is null or ${surveys.endsAt} = '' or ${surveys.endsAt} >= ${ref})`
  );
}

/**
 * Última campanha ENCERRADA de cada tipo pedido, para os envios agendados por tipo.
 *
 * "Encerrada" aqui é pela vigência, não pelo status: a campanha cujo `ends_at` já passou
 * e é o mais recente do tipo. É o que faz o relatório seguir sozinho quando uma campanha
 * sucede a outra (01–05, depois 05–10): no dia 06 resolve a de 01–05; no dia 11, a de
 * 05–10 — mesmo que uma nova já esteja rodando, porque o relatório é do ciclo fechado.
 *
 * Campanhas sem `ends_at` são ignoradas: sem data de fim não há ciclo a fechar, e incluí-las
 * faria o envio repetir a mesma pesquisa aberta indefinidamente.
 *
 * Uma query só para todos os tipos (DISTINCT ON), em vez de uma por tipo.
 */
export async function findLatestEndedSurveyByType(
  projectId: string,
  types: string[],
  ref: string = today()
): Promise<SurveyRow[]> {
  if (types.length === 0) return [];
  return db
    .selectDistinctOn([surveys.type])
    .from(surveys)
    .where(
      and(
        eq(surveys.projectId, projectId),
        inArray(surveys.type, types),
        sql`${surveys.endsAt} is not null and ${surveys.endsAt} <> '' and ${surveys.endsAt} < ${ref}`
      )
    )
    // DISTINCT ON exige que o ORDER BY comece pela expressão distinta; o ends_at desc
    // dentro de cada tipo é o que elege a campanha encerrada mais recentemente
    .orderBy(surveys.type, desc(surveys.endsAt));
}

/** Pesquisas ativas e dentro da vigência de um projeto (para a API pública do SDK). */
export async function listActiveSurveys(projectId: string) {
  return db
    .select()
    .from(surveys)
    .where(and(eq(surveys.projectId, projectId), eq(surveys.status, "ativa"), withinScheduleSql(today())))
    .orderBy(desc(surveys.publishedAt));
}

/**
 * Versão enxuta para /api/v1/config — a rota que TODO visitante dos sites dos clientes chama.
 * Seleciona só as 13 colunas que o SDK usa, em vez de `select()` (linha inteira, incluindo
 * campos que o widget nunca lê). Menos bytes por linha, no endpoint de maior volume.
 */
export async function listActiveSurveysForSdk(projectId: string) {
  return db
    .select({
      id: surveys.id,
      name: surveys.name,
      type: surveys.type,
      appearance: surveys.appearance,
      trigger: surveys.trigger,
      triggerEvent: surveys.triggerEvent,
      triggerEvents: surveys.triggerEvents,
      audience: surveys.audience,
      audienceMode: surveys.audienceMode,
      audienceList: surveys.audienceList,
      frequency: surveys.frequency,
    })
    .from(surveys)
    .where(and(eq(surveys.projectId, projectId), eq(surveys.status, "ativa"), withinScheduleSql(today())))
    .orderBy(desc(surveys.publishedAt));
}

/**
 * Traduz o ?surveyId da URL no recorte que as páginas de dados devem usar:
 * ausente → última pesquisa vigente/criada; "all" → todas (escolha explícita do
 * usuário); qualquer outro valor → aquela pesquisa. Devolve também o valor que o
 * <select> do DataFilters deve exibir, pra barra não dizer "todas" enquanto os
 * números na tela são de uma pesquisa só.
 */
export async function resolveSurveyScope(projectId: string, surveyIdParam?: string) {
  if (surveyIdParam === "all") return { surveyId: undefined, defaultSurveyId: "all" };
  if (surveyIdParam) return { surveyId: surveyIdParam, defaultSurveyId: surveyIdParam };
  const fallback = await getDefaultSurveyId(projectId);
  return { surveyId: fallback, defaultSurveyId: fallback };
}
