/*
  Jornada do estudante (PURO: roda no painel e nos testes). Traduz as TELAS que o Analytics já
  coleta em ações de produto: "abriu", "iniciou" e "concluiu" uma Prova Genial, uma Tarefa, um
  teste prático, um quiz de curso, uma redação.

  Pela tela e não pelo clique: cada etapa dessas atividades tem uma URL própria (a de resultado só
  aparece depois da entrega), o que é mais confiável que o texto de um botão e não pede nada ao
  time do produto. Como a tradução é feita na leitura, vale também para o que já foi coletado.

  As rotas são as do GenieX (preparasp.jovensgenios.com, levantadas em 23/11/2026), já
  normalizadas pelo SDK (ids viram ":id"). Algumas telas existem em português e em inglês; as
  duas entram. Em outros produtos nada casa e o perfil segue como antes.
*/

export const STAGES = ["viu", "iniciou", "concluiu"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = { viu: "Abriu", iniciou: "Iniciou", concluiu: "Concluiu" };

export type ActivityIcon = "prova" | "tarefa" | "teste" | "quiz" | "redacao";

export interface Activity {
  id: string;
  label: string;
  icon: ActivityIcon;
  /** telas (rota normalizada, sem a barra inicial) de cada etapa */
  stages: Partial<Record<Stage, string[]>>;
}

export const ACTIVITIES: Activity[] = [
  {
    id: "prova_genial",
    label: "Prova Genial",
    icon: "prova",
    stages: {
      viu: ["instituicao/avaliacoes/:id", "instituicao/avaliacoes/:id/onboarding", "institutions/summative-assessments/:id", "institutions/summative-assessments/:id/onboarding"],
      iniciou: ["instituicao/avaliacoes/:id/quiz", "institutions/summative-assessments/:id/quiz"],
      concluiu: ["instituicao/avaliacoes/:id/results", "institutions/summative-assessments/:id/results"],
    },
  },
  {
    id: "tarefa",
    label: "Tarefa",
    icon: "tarefa",
    stages: {
      viu: ["instituicao/assignments/:id", "institutions/assignments/:id"],
      iniciou: ["instituicao/assignments/:id/topic/:id/quiz", "institutions/assignments/:id/topic/:id/quiz"],
      concluiu: ["instituicao/assignments/:id/complete", "institutions/assignments/:id/complete"],
    },
  },
  {
    id: "teste_pratico",
    label: "Teste prático",
    icon: "teste",
    stages: {
      iniciou: ["testes-praticos/:id/quiz", "practice-tests/:id/quiz"],
      concluiu: ["testes-praticos/:id/report", "practice-tests/:id/report"],
    },
  },
  {
    id: "quiz_curso",
    label: "Quiz de curso",
    icon: "quiz",
    stages: {
      iniciou: ["quiz/:id"],
      concluiu: ["quiz/:id/result"],
    },
  },
  {
    id: "redacao",
    label: "Redação",
    icon: "redacao",
    stages: {
      iniciou: ["redacao/:id", "essays/:id"],
      concluiu: ["redacao/:id/result", "essays/:id/result"],
    },
  },
];

const BY_PATH = new Map<string, { activity: Activity; stage: Stage }>();
for (const activity of ACTIVITIES) for (const stage of STAGES) for (const p of activity.stages[stage] ?? []) BY_PATH.set(p, { activity, stage });

/** A etapa de atividade que esta tela representa (null = tela comum). */
export function stepOf(path: string): { activity: Activity; stage: Stage } | null {
  return BY_PATH.get(path.replace(/^\/+|\/+$/g, "")) ?? null;
}

/** "Concluiu a Prova Genial", "Iniciou a Tarefa", "Abriu o Teste prático". */
export function stepLabel(step: { activity: Activity; stage: Stage }): string {
  const art = step.activity.icon === "teste" || step.activity.icon === "quiz" ? "o" : "a";
  return `${STAGE_LABEL[step.stage]} ${art} ${step.activity.label}`;
}

export interface ActivitySummary {
  activity: Activity;
  /** quantas vezes cada etapa apareceu */
  counts: Record<Stage, number>;
  /** sessões em que iniciou e não chegou ao resultado depois */
  unfinished: number;
  /** a etapa mais recente e quando */
  last: { stage: Stage; at: string };
}

/**
 * Resumo das atividades de uma pessoa a partir das telas das sessões (cada sessão com as telas
 * em ordem). Uma atividade sem nenhuma tela reconhecida fica de fora.
 */
export function summarizeJourney(sessions: { pages: { path: string; at: string }[] }[]): ActivitySummary[] {
  const out = new Map<string, ActivitySummary>();
  for (const s of sessions) {
    // por atividade: iniciou nesta sessão e ainda não concluiu depois disso
    const open = new Map<string, boolean>();
    for (const pg of s.pages) {
      const step = stepOf(pg.path);
      if (!step) continue;
      const id = step.activity.id;
      const sum = out.get(id) ?? { activity: step.activity, counts: { viu: 0, iniciou: 0, concluiu: 0 }, unfinished: 0, last: { stage: step.stage, at: pg.at } };
      sum.counts[step.stage] += 1;
      if (Date.parse(pg.at) >= Date.parse(sum.last.at)) sum.last = { stage: step.stage, at: pg.at };
      out.set(id, sum);
      if (step.stage === "iniciou") open.set(id, true);
      if (step.stage === "concluiu") open.set(id, false);
    }
    for (const [id, pending] of open) if (pending) out.get(id)!.unfinished += 1;
  }
  return ACTIVITIES.map((a) => out.get(a.id)).filter((x): x is ActivitySummary => !!x);
}
