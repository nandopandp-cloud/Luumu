/** Pesquisas de exemplo usadas pelo seed do banco (scripts/seed.ts). */
import type { SurveyStatus, SurveyType } from "@/lib/surveys/types";

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
