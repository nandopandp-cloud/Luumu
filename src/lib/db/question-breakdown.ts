import "server-only";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { db } from "./client";
import { answers, questions, responses, surveys } from "@/lib/db/schema";
import { scopeWhere, type Scope } from "./responses";
import { blockKind, scoreBlocks, type QuestionConfig } from "@/lib/surveys/builder";
import { defaultScaleForBlock } from "@/lib/surveys/scoring";

/*
  Análise por pergunta de UMA pesquisa: quantas pessoas deram cada nota (ou escolheram cada
  opção), com o percentual e a média. É o que o SUS precisa — cada item tem leitura própria
  (os ímpares são positivos, os pares negativos), então só a nota agregada esconde o que
  importa. Vale para qualquer pesquisa com perguntas de nota ou de opção.
*/

export interface QuestionBucket {
  label: string;
  count: number;
  /** % de quem respondeu a pergunta (no checkbox a soma passa de 100%: escolhe-se várias) */
  pct: number;
}

export interface QuestionStat {
  id: string;
  /** posição na pesquisa (1, 2, 3…), a mesma numeração do builder */
  number: number;
  title: string;
  blockId: string;
  kind: "scale" | "options";
  /** quantas respostas trazem esta pergunta respondida */
  answered: number;
  /** média das notas (só perguntas de nota) */
  avg: number | null;
  minLabel?: string;
  maxLabel?: string;
  buckets: QuestionBucket[];
}

type QuestionRow = { id: string; order: number; blockId: string; title: string; config: unknown };

/** Perguntas da pesquisa na ordem do builder — só se ela for do projeto (o id pode vir da URL). */
async function surveyQuestions(projectId: string, surveyId: string): Promise<QuestionRow[]> {
  return db
    .select({ id: questions.id, order: questions.order, blockId: questions.blockId, title: questions.title, config: questions.config })
    .from(questions)
    .innerJoin(surveys, eq(surveys.id, questions.surveyId))
    .where(and(eq(questions.surveyId, surveyId), eq(surveys.projectId, projectId)))
    .orderBy(asc(questions.order));
}

const isScale = (blockId: string) => scoreBlocks.has(blockId) || blockId === "emoji";
const isQuantifiable = (blockId: string) => isScale(blockId) || blockKind[blockId] === "options";

/** Faixa de notas da pergunta (min..max), com os defaults de cada bloco. */
function scaleOf(blockId: string, cfg: QuestionConfig): { min: number; max: number } {
  if (blockId === "emoji") return { min: 1, max: 5 };
  if (blockId === "stars") return { min: 1, max: cfg.max ?? 5 };
  const d = defaultScaleForBlock(blockId);
  return { min: cfg.min ?? d.min, max: cfg.max ?? d.max };
}

/** Valor gravado numa answer: `{ score }` (nota), `{ text }` (texto) ou `{ value }` (demais). */
function rawValue(value: unknown): unknown {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return value;
  const v = value as Record<string, unknown>;
  return v.score ?? v.text ?? v.value;
}

const isBlank = (v: unknown) => v == null || v === "" || (Array.isArray(v) && v.length === 0);

/**
 * Distribuição de cada pergunta de nota/opção da pesquisa do escopo, respeitando os mesmos
 * filtros das outras métricas (plataforma, período, desconsideradas). Uma consulta só,
 * agrupada no banco por pergunta + valor.
 */
export async function getQuestionBreakdown(scope: Scope & { surveyId: string }): Promise<QuestionStat[]> {
  const qs = (await surveyQuestions(scope.projectId, scope.surveyId)).filter((q) => isQuantifiable(q.blockId));
  if (qs.length === 0) return [];

  const rows = await db
    .select({ questionId: answers.questionId, value: answers.value, n: count() })
    .from(answers)
    .innerJoin(responses, eq(responses.id, answers.responseId))
    .innerJoin(surveys, eq(surveys.id, responses.surveyId))
    .where(and(scopeWhere(scope), inArray(answers.questionId, qs.map((q) => q.id))))
    .groupBy(answers.questionId, answers.value);

  const byQuestion = new Map<string, { value: unknown; n: number }[]>();
  for (const r of rows) {
    const value = rawValue(r.value);
    if (isBlank(value)) continue;
    const list = byQuestion.get(r.questionId) ?? [];
    list.push({ value, n: Number(r.n) });
    byQuestion.set(r.questionId, list);
  }

  return qs.map((q) => {
    const cfg = (q.config ?? {}) as QuestionConfig;
    const got = byQuestion.get(q.id) ?? [];
    const answered = got.reduce((s, g) => s + g.n, 0);
    const pct = (n: number) => (answered ? Math.round((n / answered) * 1000) / 10 : 0);
    const base = { id: q.id, number: q.order + 1, title: q.title, blockId: q.blockId, answered };

    if (isScale(q.blockId)) {
      const { min, max } = scaleOf(q.blockId, cfg);
      const counts = new Map<number, number>();
      let sum = 0;
      for (const g of got) {
        const n = Number(g.value);
        if (!Number.isFinite(n)) continue;
        counts.set(n, (counts.get(n) ?? 0) + g.n);
        sum += n * g.n;
      }
      const buckets: QuestionBucket[] = [];
      for (let v = min; v <= max; v++) buckets.push({ label: String(v), count: counts.get(v) ?? 0, pct: pct(counts.get(v) ?? 0) });
      return {
        ...base,
        kind: "scale" as const,
        avg: answered ? Math.round((sum / answered) * 100) / 100 : null,
        minLabel: cfg.minLabel || undefined,
        maxLabel: cfg.maxLabel || undefined,
        buckets,
      };
    }

    // opções: as configuradas, na ordem do builder, + as que só existem em respostas antigas
    const counts = new Map<string, number>();
    for (const g of got) {
      for (const opt of Array.isArray(g.value) ? g.value : [g.value]) {
        const k = String(opt);
        counts.set(k, (counts.get(k) ?? 0) + g.n);
      }
    }
    const labels = [...(cfg.options ?? []), ...[...counts.keys()].filter((k) => !(cfg.options ?? []).includes(k))];
    return {
      ...base,
      kind: "options" as const,
      avg: null,
      buckets: labels.map((label) => ({ label, count: counts.get(label) ?? 0, pct: pct(counts.get(label) ?? 0) })),
    };
  });
}

/**
 * Respostas de cada pessoa pergunta a pergunta, para a exportação de uma pesquisa (uma
 * coluna por pergunta, como numa planilha de formulário). `values` segue a ordem de `columns`.
 */
export async function getAnswerColumns(
  projectId: string,
  surveyId: string,
  responseIds: string[]
): Promise<{ columns: string[]; values: Map<string, (string | number | null)[]> }> {
  const qs = await surveyQuestions(projectId, surveyId);
  const values = new Map<string, (string | number | null)[]>();
  if (qs.length === 0 || responseIds.length === 0) return { columns: qs.map(columnName), values };

  const index = new Map(qs.map((q, i) => [q.id, i]));
  // em lotes: um IN gigante estoura o limite de parâmetros numa pesquisa com muitas respostas
  for (let i = 0; i < responseIds.length; i += 1000) {
    const rows = await db
      .select({ responseId: answers.responseId, questionId: answers.questionId, value: answers.value })
      .from(answers)
      .where(inArray(answers.responseId, responseIds.slice(i, i + 1000)));
    for (const r of rows) {
      const col = index.get(r.questionId);
      if (col === undefined) continue; // pergunta que saiu da pesquisa
      const raw = rawValue(r.value);
      if (isBlank(raw)) continue;
      const line = values.get(r.responseId) ?? qs.map(() => null);
      line[col] = typeof raw === "number" ? raw : Array.isArray(raw) ? raw.join(", ") : String(raw);
      values.set(r.responseId, line);
    }
  }
  return { columns: qs.map(columnName), values };
}

function columnName(q: QuestionRow): string {
  return `P${q.order + 1}: ${q.title.trim()}`;
}
