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
  /** id da atividade em ACTIVITIES */
  id: string;
  /** quantas vezes cada etapa apareceu */
  counts: Record<Stage, number>;
  /** sessões em que iniciou e não concluiu */
  unfinished: number;
  /** a sessão mais recente com a atividade: quando começou e até onde chegou nela */
  last: { stage: Stage; at: string };
}

/** Uma tela de atividade numa sessão, com quantas vezes apareceu (do resumo diário ou das telas). */
export interface JourneyRow {
  sessionId: string;
  /** início da sessão */
  at: string;
  path: string;
  count: number;
}

/** Todas as telas que contam como etapa de alguma atividade (filtro das consultas). */
export const JOURNEY_PATHS: string[] = [...BY_PATH.keys()];

export const activityById = (id: string) => ACTIVITIES.find((a) => a.id === id) ?? null;

/**
 * Resumo das atividades de uma pessoa. Sem depender da ordem das telas (o resumo diário guarda
 * quantas vezes cada tela apareceu, não a sequência): "não concluiu" = sessão em que iniciou e
 * não chegou ao resultado. Atividade sem nenhuma tela reconhecida fica de fora.
 */
export function summarizeJourney(rows: JourneyRow[]): ActivitySummary[] {
  // por sessão e atividade: as contagens de cada etapa
  const per = new Map<string, { id: string; at: string; counts: Record<Stage, number> }>();
  for (const r of rows) {
    const step = stepOf(r.path);
    if (!step || r.count <= 0) continue;
    const k = `${r.sessionId}\u0000${step.activity.id}`;
    const cur = per.get(k) ?? { id: step.activity.id, at: r.at, counts: { viu: 0, iniciou: 0, concluiu: 0 } };
    cur.counts[step.stage] += r.count;
    per.set(k, cur);
  }
  const out = new Map<string, ActivitySummary>();
  for (const x of per.values()) {
    const reached = [...STAGES].reverse().find((st) => x.counts[st] > 0)!;
    const sum = out.get(x.id) ?? { id: x.id, counts: { viu: 0, iniciou: 0, concluiu: 0 }, unfinished: 0, last: { stage: reached, at: x.at } };
    for (const st of STAGES) sum.counts[st] += x.counts[st];
    if (x.counts.iniciou > 0 && x.counts.concluiu === 0) sum.unfinished += 1;
    if (Date.parse(x.at) > Date.parse(sum.last.at)) sum.last = { stage: reached, at: x.at };
    out.set(x.id, sum);
  }
  return ACTIVITIES.map((a) => out.get(a.id)).filter((x): x is ActivitySummary => !!x);
}
