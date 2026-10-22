/** Tipos de domínio das pesquisas (client-safe). */

export type SurveyStatus = "ativa" | "rascunho" | "pausada" | "encerrada";
export type SurveyType =
  | "CSAT" | "NPS" | "CES" | "SUS" | "PMF" | "Onboarding"
  | "Exit" | "Churn" | "Feature" | "Beta" | "Personalizada";
