/** Tipos de domínio das pesquisas (client-safe). */

export type SurveyStatus = "ativa" | "rascunho" | "pausada" | "encerrada";

/**
 * Nome de cada status na interface. O valor "encerrada" continua no banco (SDK, página pública,
 * relatórios e cron o leem), mas no painel ela se chama "Arquivada": é a pesquisa tirada da lista
 * de trabalho, de qualquer status.
 */
export const SURVEY_STATUS_LABEL: Record<SurveyDisplayStatus, string> = {
  ativa: "Ativa",
  agendada: "Agendada",
  rascunho: "Rascunho",
  pausada: "Pausada",
  encerrada: "Arquivada",
};

/**
 * Status mostrado no painel. "agendada" não é gravada: é a pesquisa publicada ("ativa") cuja
 * vigência ainda não começou. O SDK e a página pública já só exibem pesquisa ativa DENTRO da
 * vigência, então ela entra no ar sozinha na data de início e sai na de fim, sem cron.
 */
export type SurveyDisplayStatus = SurveyStatus | "agendada";

/** Rótulo de um status vindo do banco (texto livre): o próprio texto se for desconhecido. */
export const surveyStatusLabel = (status: string) => SURVEY_STATUS_LABEL[status as SurveyDisplayStatus] ?? status;
export type SurveyType =
  | "CSAT" | "NPS" | "CES" | "SUS" | "PMF" | "Onboarding"
  | "Exit" | "Churn" | "Feature" | "Beta" | "Personalizada";
