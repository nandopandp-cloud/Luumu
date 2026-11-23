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

test("resumo sem depender da ordem: contagem por etapa, a sessão mais recente e quem iniciou sem concluir", () => {
  const r = (sessionId: string, at: string, path: string, count = 1) => ({ sessionId, at, path, count });
  const rows = [
    // prova inteira (do resumo diário: contagens, sem ordem)
    r("s1", "2026-11-16T10:00:00Z", "instituicao/avaliacoes/:id/results"),
    r("s1", "2026-11-16T10:00:00Z", "instituicao/avaliacoes/:id/onboarding"),
    r("s1", "2026-11-16T10:00:00Z", "instituicao/avaliacoes/:id/quiz", 2),
    // sessão mais recente: iniciou a tarefa e saiu
    r("s2", "2026-11-19T11:00:00Z", "instituicao/assignments/:id"),
    r("s2", "2026-11-19T11:00:00Z", "instituicao/assignments/:id/topic/:id/quiz"),
    // outra tarefa, concluída
    r("s3", "2026-11-18T09:00:00Z", "instituicao/assignments/:id/topic/:id/quiz"),
    r("s3", "2026-11-18T09:00:00Z", "instituicao/assignments/:id/complete"),
    // tela comum não entra
    r("s3", "2026-11-18T09:00:00Z", "home", 5),
  ];
  const [prova, tarefa] = summarizeJourney(rows);
  assert.equal(prova.id, "prova_genial");
  assert.deepEqual(prova.counts, { viu: 1, iniciou: 2, concluiu: 1 });
  assert.equal(prova.unfinished, 0);
  assert.deepEqual(prova.last, { stage: "concluiu", at: "2026-11-16T10:00:00Z" });
  assert.equal(tarefa.id, "tarefa");
  assert.deepEqual(tarefa.counts, { viu: 1, iniciou: 2, concluiu: 1 });
  assert.equal(tarefa.unfinished, 1, "só a sessão s2");
  assert.deepEqual(tarefa.last, { stage: "iniciou", at: "2026-11-19T11:00:00Z" });
  assert.equal(summarizeJourney([r("s9", "2026-11-19T11:00:00Z", "home")]).length, 0);
});
