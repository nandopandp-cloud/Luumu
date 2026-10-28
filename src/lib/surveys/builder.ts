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
  /** texto curto/longo: ausente = placeholder desativado; presente = ativado (texto obrigatório) */
  placeholder?: string;
}

/** Placeholder ativado mas sem texto — impede a publicação. */
export function isPlaceholderMissing(blockId: string, config: QuestionConfig | null | undefined): boolean {
  return blockKind[blockId] === "text" && typeof config?.placeholder === "string" && !config.placeholder.trim();
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
export const blockKind: Record<string, "scale" | "options" | "text" | "simple" | "message"> = {
  greeting: "message",
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

/**
 * Blocos que só exibem um texto (ex.: a Saudação antes da pesquisa): não pedem nem gravam
 * resposta, nunca são obrigatórios e ficam fora de relatórios, exportações e condições.
 */
export const isMessageBlock = (blockId: string) => blockKind[blockId] === "message";

/** Texto inicial de cada bloco novo arrastado para a pesquisa. */
export function defaultTitle(blockId: string, label: string): string {
  if (blockId === "greeting") return "Olá! Vamos começar uma pesquisa bem rapidinho?";
  return `Nova pergunta: ${label}`;
}

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
    default:
      return {};
  }
}

/** Blocos disponíveis no builder drag-and-drop. */
export const builderBlocks = [
  { id: "greeting", label: "Saudação", hint: "Texto de abertura" },
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
