/** Tipos e helpers compartilhados do builder de pesquisas (client-safe). */

/* ---- Aparência do widget embutido ---- */
export type WidgetFormat = "popup" | "slider" | "modal" | "bar";
export type WidgetPosition = "bottom-right" | "bottom-left" | "top" | "bottom" | "center";
export type WidgetTheme = "auto" | "light" | "dark";

export interface Appearance {
  format: WidgetFormat;
  position: WidgetPosition;
  theme: WidgetTheme;
  triggerDelay: number; // segundos até aparecer
  accent: string; // cor de destaque
}

export const defaultAppearance: Appearance = {
  format: "popup",
  position: "bottom-right",
  theme: "auto",
  triggerDelay: 3,
  accent: "#6B2BD9",
};

/** Posições válidas para cada formato. */
export const positionsByFormat: Record<WidgetFormat, WidgetPosition[]> = {
  popup: ["bottom-right", "bottom-left"],
  slider: ["bottom-right", "bottom-left"],
  modal: ["center"],
  bar: ["top", "bottom"],
};

/** Formato de widget sugerido por tipo de pesquisa (client-safe). */
export function defaultAppearanceFor(type: string): Appearance {
  const byType: Record<string, Partial<Appearance>> = {
    NPS: { format: "bar", position: "bottom" },
    PMF: { format: "modal", position: "center" },
    Onboarding: { format: "modal", position: "center" },
    CES: { format: "slider", position: "bottom-right" },
  };
  return { ...defaultAppearance, ...(byType[type] ?? {}) };
}

export function normalizeAppearance(raw: unknown): Appearance {
  const a = (raw ?? {}) as Partial<Appearance>;
  const format = (["popup", "slider", "modal", "bar"] as const).includes(a.format as WidgetFormat)
    ? (a.format as WidgetFormat)
    : "popup";
  const allowed = positionsByFormat[format];
  const position = allowed.includes(a.position as WidgetPosition)
    ? (a.position as WidgetPosition)
    : allowed[0];
  return {
    format,
    position,
    theme: (["auto", "light", "dark"] as const).includes(a.theme as WidgetTheme) ? (a.theme as WidgetTheme) : "auto",
    triggerDelay: typeof a.triggerDelay === "number" ? a.triggerDelay : 3,
    accent: typeof a.accent === "string" && a.accent ? a.accent : "#6B2BD9",
  };
}


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
