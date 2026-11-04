/** Tipos de domínio das pesquisas (client-safe). */

export type SurveyStatus = "ativa" | "rascunho" | "pausada" | "encerrada";

/**
 * Nome de cada status na interface. O valor "encerrada" continua no banco (SDK, página pública,
 * relatórios e cron o leem), mas no painel ela se chama "Arquivada": é a pesquisa tirada da lista
 * de trabalho, de qualquer status.
 */
export const SURVEY_STATUS_LABEL: Record<SurveyStatus, string> = {
  ativa: "Ativa",
  rascunho: "Rascunho",
  pausada: "Pausada",
  encerrada: "Arquivada",
};

/** Rótulo de um status vindo do banco (texto livre): o próprio texto se for desconhecido. */
export const surveyStatusLabel = (status: string) => SURVEY_STATUS_LABEL[status as SurveyStatus] ?? status;
export type SurveyType =
  | "CSAT" | "NPS" | "CES" | "SUS" | "PMF" | "Onboarding"
  | "Exit" | "Churn" | "Feature" | "Beta" | "Personalizada";
