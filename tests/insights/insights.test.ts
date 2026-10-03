import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyComment } from "../../lib/insights/themes";
import { analyzeInsights, levelFromScore, type AnalyzedResponse } from "../../lib/insights/analyze";
import { answerQuestion, detectIntent } from "../../lib/insights/ask";
import { insightsMock } from "../../lib/insights/mock";

test("dicionário: temas, pedidos, ruído e palavrão (comentários reais)", () => {
  assert.deepEqual(classifyComment("um lixo o site nao carrega de jeito nenhum").themes, ["performance"]);
  assert.ok(classifyComment("muitas tarefas cansativas, assim sobrecarregando os alunos.").themes.includes("workload"));
  assert.ok(classifyComment("o ranking que era p motivar acaba desmotivando").themes.includes("scoring"));
  const req = classifyComment("deveria ter mais matérias para estudar, e também mais simulados");
  assert.ok(req.request && req.themes.includes("content"));
  assert.ok(classifyComment("Nada").noise);
  assert.ok(classifyComment("Esse site é uma merda").profane);
  assert.ok(!classifyComment("Tem bugs, e é difícil de mecher nele.").noise);
});

test("nível de sentimento pela posição na escala", () => {
  const csat = { min: 1, max: 5 };
  assert.deepEqual([1, 2, 3, 4, 5].map((s) => levelFromScore(s, csat)), ["very_negative", "negative", "neutral", "positive", "very_positive"]);
  const nps = { min: 0, max: 10 };
  assert.equal(levelFromScore(9, nps), "very_positive");
  assert.equal(levelFromScore(7, nps), "positive");
  assert.equal(levelFromScore(5, nps), "neutral");
  assert.equal(levelFromScore(0, nps), "very_negative");
});

const day = (d: string) => new Date(`${d}T12:00:00Z`);
let n = 0;
const r = (date: string, score: number, comment = ""): AnalyzedResponse => ({
  id: `r${++n}`,
  createdAt: day(date),
  score,
  sentiment: score >= 4 ? "positivo" : score === 3 ? "neutro" : "negativo",
  level: levelFromScore(score, { min: 1, max: 5 }),
  comment,
});

test("análise: temas, recomendações com evidências, mudanças e lacunas na evolução", () => {
  const current = [
    r("2026-09-29", 1, "o site trava muito e não carrega"),
    r("2026-09-29", 2, "demora demais para carregar"),
    r("2026-09-30", 1, "trava toda hora no carregamento"),
    r("2026-09-30", 5, "muito fácil de usar, adorei"),
    r("2026-10-01", 4, "interface simples e prática"),
    r("2026-10-01", 3, "deveria ter mais simulados"),
    r("2026-10-01", 3, "falta conteúdo de matemática, poderia ter mais"),
    r("2026-10-01", 5),
    r("2026-09-15", 5), // semana anterior com resposta, e uma semana vazia entre elas
  ];
  const previous = [r("2026-09-01", 5, "rápido e fácil"), r("2026-09-02", 2, "trava às vezes"), r("2026-09-02", 5, "simples de usar")];
  const d = analyzeInsights({ periodLabel: "últimos 30 dias", now: day("2026-10-02"), current, previous, satisfaction: null });

  assert.equal(d.totalResponses, 9);
  assert.equal(d.topics[0].id, "performance");
  assert.ok(d.topics[0].keywords.some((k) => k.word === "travamento"));
  const perf = d.recommendations.find((x) => x.themeId === "performance")!;
  assert.equal(perf.kind, "attention");
  assert.equal(perf.evidence.analyzed, 3);
  assert.ok(perf.evidence.comments.length > 0);
  assert.ok(d.recommendations.some((x) => x.kind === "opportunity" && x.themeId === "content"));
  assert.ok(d.summary.attention.items.includes("Performance e estabilidade"));
  assert.ok(d.summary.positives.items.includes("Facilidade de uso"));
  assert.ok(d.changes.some((c) => c.id === "performance" && !c.good), "críticas de performance cresceram");
  // semana sem resposta no meio é lacuna (null), nunca 0%
  const weeks = d.sentimentEvolution.week;
  assert.ok(weeks.some((w) => w.levels === null));
  assert.ok(weeks.filter((w) => w.levels).every((w) => Object.values(w.levels!).reduce((a, b) => a + b, 0) >= 99));
  // destaques: um positivo e um negativo, nunca ruído ou palavrão
  assert.deepEqual(d.featuredComments.map((c) => c.sentiment).sort(), ["negativo", "positivo"]);
});

test("perguntas: responde com os dados da tela e não inventa", () => {
  assert.equal(detectIntent("Por que o CSAT caiu este mês?"), "drop");
  assert.equal(detectIntent("Quais são os principais problemas?"), "problems");
  assert.equal(detectIntent("O que melhorou no último período?"), "improved");
  assert.equal(detectIntent("Quais funcionalidades os clientes pedem?"), "requests");

  const drop = answerQuestion("Por que o CSAT caiu este mês?", insightsMock);
  assert.ok(drop.answered && /não piorou/.test(drop.text), drop.text); // mock: CSAT subiu 4 p.p.
  const problems = answerQuestion("Quais são os principais problemas?", insightsMock);
  assert.ok(problems.text.includes("performance"));
  const free = answerQuestion("Qual a previsão do tempo para amanhã?", insightsMock);
  assert.equal(free.answered, false);
  assert.equal(free.bullets.length, 0);
});
