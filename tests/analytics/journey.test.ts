/*
  Jornada do estudante (lib/analytics/journey.ts): as telas do GenieX viram "abriu / iniciou /
  concluiu" de Prova Genial, Tarefa, teste prático, quiz e redação.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { stepLabel, stepOf, summarizeJourney } from "@/lib/analytics/journey";

test("cada tela das atividades vira a etapa certa, em português e em inglês", () => {
  const at = (p: string) => {
    const s = stepOf(p);
    return s && `${s.activity.id}:${s.stage}`;
  };
  assert.equal(at("instituicao/avaliacoes/:id/onboarding"), "prova_genial:viu");
  assert.equal(at("/instituicao/avaliacoes/:id/quiz"), "prova_genial:iniciou");
  assert.equal(at("instituicao/avaliacoes/:id/results"), "prova_genial:concluiu");
  assert.equal(at("institutions/summative-assessments/:id/results"), "prova_genial:concluiu");
  assert.equal(at("instituicao/assignments/:id"), "tarefa:viu");
  assert.equal(at("instituicao/assignments/:id/topic/:id/quiz"), "tarefa:iniciou");
  assert.equal(at("instituicao/assignments/:id/complete"), "tarefa:concluiu");
  assert.equal(at("testes-praticos/:id/report"), "teste_pratico:concluiu");
  assert.equal(at("quiz/:id/result"), "quiz_curso:concluiu");
  assert.equal(at("essays/:id/result"), "redacao:concluiu");
  // telas comuns (e sub-abas do relatório) não são etapa
  assert.equal(at("home"), null);
  assert.equal(at("testes-praticos/:id/report/disciplines"), null);
  assert.equal(stepLabel(stepOf("instituicao/avaliacoes/:id/results")!), "Concluiu a Prova Genial");
  assert.equal(stepLabel(stepOf("testes-praticos/:id/quiz")!), "Iniciou o Teste prático");
});

test("resumo: contagem por etapa, a mais recente e quem iniciou sem chegar ao resultado", () => {
  const sessions = [
    // sessão mais recente: iniciou a tarefa e saiu
    { pages: [{ path: "home", at: "2026-11-19T11:00:00Z" }, { path: "instituicao/assignments/:id", at: "2026-11-19T11:01:00Z" }, { path: "instituicao/assignments/:id/topic/:id/quiz", at: "2026-11-19T11:02:00Z" }] },
    // prova inteira
    {
      pages: [
        { path: "instituicao/avaliacoes/:id/onboarding", at: "2026-11-16T10:00:00Z" },
        { path: "instituicao/avaliacoes/:id/quiz", at: "2026-11-16T10:01:00Z" },
        { path: "instituicao/avaliacoes/:id/results", at: "2026-11-16T10:40:00Z" },
      ],
    },
  ];
  const [prova, tarefa] = summarizeJourney(sessions);
  assert.equal(prova.activity.id, "prova_genial");
  assert.deepEqual(prova.counts, { viu: 1, iniciou: 1, concluiu: 1 });
  assert.equal(prova.unfinished, 0);
  assert.deepEqual(prova.last, { stage: "concluiu", at: "2026-11-16T10:40:00Z" });
  assert.equal(tarefa.activity.id, "tarefa");
  assert.deepEqual(tarefa.counts, { viu: 1, iniciou: 1, concluiu: 0 });
  assert.equal(tarefa.unfinished, 1);
  assert.equal(summarizeJourney([{ pages: [{ path: "home", at: "2026-11-19T11:00:00Z" }] }]).length, 0);
});
