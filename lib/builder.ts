/** Tipos e helpers compartilhados do builder de pesquisas (client-safe). */

export interface QuestionConfig {
  options?: string[];
  min?: number;
  max?: number;
  minLabel?: string;
  maxLabel?: string;
  placeholder?: string;
}

export interface QuestionLogic {
  showIf?: {
    questionUid: string;
    op: "lte" | "gte" | "eq";
    value: number | string;
  };
}

export interface BuilderQuestion {
  uid: string;
  blockId: string;
  title: string;
  required: boolean;
  config: QuestionConfig;
  logic: QuestionLogic;
}

/** Categoriza cada bloco para saber quais controles exibir no painel. */
export const blockKind: Record<string, "scale" | "options" | "text" | "simple"> = {
  rating: "scale",
  emoji: "simple",
  stars: "scale",
  scale: "scale",
  nps: "scale",
  csat: "scale",
  ces: "scale",
  short: "text",
  long: "text",
  choice: "options",
  checkbox: "options",
  dropdown: "options",
  date: "simple",
  file: "simple",
};

/** Blocos que produzem uma "nota" numérica (para score/sentimento). */
export const scoreBlocks = new Set(["rating", "stars", "scale", "nps", "csat", "ces"]);

/** Defaults de config por bloco ao criar uma pergunta nova. */
export function defaultConfig(blockId: string): QuestionConfig {
  switch (blockId) {
    case "nps":
      return { min: 0, max: 10, minLabel: "Nada provável", maxLabel: "Muito provável" };
    case "ces":
      return { min: 1, max: 7, minLabel: "Discordo", maxLabel: "Concordo" };
    case "csat":
    case "rating":
    case "scale":
      return { min: 1, max: 5, minLabel: "Ruim", maxLabel: "Ótimo" };
    case "stars":
      return { max: 5 };
    case "choice":
    case "checkbox":
    case "dropdown":
      return { options: ["Opção 1", "Opção 2", "Opção 3"] };
    case "short":
      return { placeholder: "Sua resposta" };
    case "long":
      return { placeholder: "Escreva aqui…" };
    default:
      return {};
  }
}
