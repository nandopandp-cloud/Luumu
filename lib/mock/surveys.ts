export type SurveyStatus = "ativa" | "rascunho" | "pausada" | "encerrada";
export type SurveyType =
  | "CSAT" | "NPS" | "CES" | "SUS" | "PMF" | "Onboarding"
  | "Exit" | "Churn" | "Feature" | "Beta" | "Personalizada";

export interface Survey {
  id: string;
  name: string;
  type: SurveyType;
  status: SurveyStatus;
  channel: string;
  responses: number;
  rate: number;
  score: number | null;
  updatedAt: string;
}

export const surveys: Survey[] = [
  { id: "onb-clientes", name: "Onboarding de clientes", type: "Onboarding", status: "ativa", channel: "In-app", responses: 312, rate: 24, score: 4.8, updatedAt: "há 2h" },
  { id: "csat-produto", name: "Satisfação · Produto", type: "CSAT", status: "ativa", channel: "E-mail", responses: 640, rate: 31, score: 4.5, updatedAt: "há 5h" },
  { id: "nps-relacionamento", name: "NPS · Relacionamento", type: "NPS", status: "ativa", channel: "Link", responses: 1248, rate: 19, score: 58, updatedAt: "ontem" },
  { id: "ces-suporte", name: "Esforço no Suporte", type: "CES", status: "pausada", channel: "WhatsApp", responses: 281, rate: 28, score: 2.1, updatedAt: "há 3 dias" },
  { id: "pmf-beta", name: "Product-Market Fit · Beta", type: "PMF", status: "ativa", channel: "In-app", responses: 174, rate: 41, score: 62, updatedAt: "há 1 dia" },
  { id: "churn-q2", name: "Churn Survey · Q2", type: "Churn", status: "encerrada", channel: "E-mail", responses: 96, rate: 18, score: null, updatedAt: "há 2 semanas" },
  { id: "feature-dashboard", name: "Feedback · Novo Dashboard", type: "Feature", status: "rascunho", channel: "In-app", responses: 0, rate: 0, score: null, updatedAt: "há 10 min" },
  { id: "exit-trial", name: "Exit Survey · Trial", type: "Exit", status: "ativa", channel: "Link", responses: 88, rate: 22, score: null, updatedAt: "há 6h" },
];

/** Templates para a tela "Nova pesquisa". */
export const surveyTemplates: { type: SurveyType; title: string; desc: string; mascot: string }[] = [
  { type: "CSAT", title: "CSAT", desc: "Satisfação com produto ou atendimento.", mascot: "Feliz" },
  { type: "NPS", title: "NPS", desc: "Probabilidade de recomendação (0–10).", mascot: "Apaixonado" },
  { type: "CES", title: "CES", desc: "Esforço do cliente para concluir uma tarefa.", mascot: "Pensativo" },
  { type: "SUS", title: "SUS", desc: "Usabilidade do sistema (10 itens).", mascot: "Analisando" },
  { type: "PMF", title: "Product-Market Fit", desc: "Quão decepcionado ficaria sem o produto.", mascot: "Animado" },
  { type: "Onboarding", title: "Onboarding", desc: "Primeira experiência dos novos usuários.", mascot: "Liderando" },
  { type: "Exit", title: "Exit Survey", desc: "Entenda quem sai antes de converter.", mascot: "Preocupado" },
  { type: "Churn", title: "Churn Survey", desc: "Motivos de cancelamento.", mascot: "Pensativo" },
  { type: "Feature", title: "Feature Feedback", desc: "Reações a uma nova funcionalidade.", mascot: "Criando" },
  { type: "Personalizada", title: "Do zero", desc: "Comece com uma tela em branco.", mascot: "Trabalhando" },
];

/** Blocos disponíveis no builder drag-and-drop. */
export const builderBlocks = [
  { id: "rating", label: "Avaliação", hint: "1–5 / estrelas" },
  { id: "emoji", label: "Emoji", hint: "Escala de emojis" },
  { id: "stars", label: "Estrelas", hint: "★★★★★" },
  { id: "scale", label: "Escala linear", hint: "0–10" },
  { id: "nps", label: "NPS", hint: "0–10 recomendação" },
  { id: "csat", label: "CSAT", hint: "Satisfação 1–5" },
  { id: "ces", label: "CES", hint: "Concordância 1–7" },
  { id: "short", label: "Texto curto", hint: "Uma linha" },
  { id: "long", label: "Texto longo", hint: "Parágrafo" },
  { id: "choice", label: "Múltipla escolha", hint: "Uma opção" },
  { id: "checkbox", label: "Checkbox", hint: "Várias opções" },
  { id: "dropdown", label: "Dropdown", hint: "Lista suspensa" },
  { id: "date", label: "Data", hint: "Seletor de data" },
  { id: "file", label: "Arquivo", hint: "Upload" },
] as const;

export type BuilderBlock = (typeof builderBlocks)[number];

/** Perguntas iniciais de exemplo no canvas do builder. */
export const initialCanvas = [
  { uid: "q1", blockId: "csat", title: "Em uma escala de 0 a 10, o quanto você está satisfeito com nosso produto?", required: true },
  { uid: "q2", blockId: "choice", title: "O que você mais gosta no nosso produto?", required: false },
  { uid: "q3", blockId: "long", title: "Como podemos melhorar sua experiência?", required: false },
];
