import type { SurveyType } from "@/lib/mock/surveys";

/** Definição de uma pergunta-semente (sem id, gerado na criação). */
export interface SeedQuestion {
  blockId: string;
  title: string;
  required: boolean;
  config?: Record<string, unknown>;
  logic?: Record<string, unknown>;
}

/** Perguntas iniciais por tipo de pesquisa — usadas ao criar do template e no seed. */
export const questionTemplates: Record<SurveyType, { name: string; questions: SeedQuestion[] }> = {
  CSAT: {
    name: "Pesquisa de Satisfação (CSAT)",
    questions: [
      { blockId: "csat", title: "Como você avalia sua satisfação com nosso produto?", required: true, config: { min: 1, max: 5 } },
      { blockId: "long", title: "O que motivou sua nota?", required: false, config: { placeholder: "Conte pra gente…" } },
    ],
  },
  NPS: {
    name: "Pesquisa de Recomendação (NPS)",
    questions: [
      { blockId: "nps", title: "De 0 a 10, o quanto você recomendaria a Luumu a um colega?", required: true, config: { min: 0, max: 10, minLabel: "Nada provável", maxLabel: "Muito provável" } },
      { blockId: "long", title: "Qual o principal motivo da sua nota?", required: false, config: { placeholder: "Sua resposta" } },
    ],
  },
  CES: {
    name: "Esforço do Cliente (CES)",
    questions: [
      { blockId: "ces", title: "A Luumu tornou fácil resolver o que eu precisava.", required: true, config: { min: 1, max: 7, minLabel: "Discordo totalmente", maxLabel: "Concordo totalmente" } },
      { blockId: "long", title: "O que poderia ter sido mais fácil?", required: false },
    ],
  },
  SUS: {
    name: "Usabilidade do Sistema (SUS)",
    questions: [
      { blockId: "scale", title: "Eu acho que usaria este sistema com frequência.", required: true, config: { min: 1, max: 5, minLabel: "Discordo", maxLabel: "Concordo" } },
      { blockId: "scale", title: "Eu achei o sistema desnecessariamente complexo.", required: true, config: { min: 1, max: 5, minLabel: "Discordo", maxLabel: "Concordo" } },
    ],
  },
  PMF: {
    name: "Product-Market Fit",
    questions: [
      { blockId: "choice", title: "Como você se sentiria se não pudesse mais usar a Luumu?", required: true, config: { options: ["Muito decepcionado", "Um pouco decepcionado", "Não me importaria"] } },
      { blockId: "long", title: "Que tipo de pessoa você acha que mais se beneficiaria da Luumu?", required: false },
    ],
  },
  Onboarding: {
    name: "Pesquisa de Onboarding",
    questions: [
      { blockId: "csat", title: "Quão fácil foi começar a usar a Luumu?", required: true, config: { min: 1, max: 5 } },
      { blockId: "choice", title: "O que quase te impediu de continuar?", required: false, config: { options: ["Nada", "Configuração complexa", "Faltou informação", "Outro"] } },
    ],
  },
  Exit: {
    name: "Exit Survey",
    questions: [
      { blockId: "choice", title: "O que fez você decidir sair agora?", required: true, config: { options: ["Só explorando", "Muito caro", "Faltou uma funcionalidade", "Escolhi outra ferramenta"] } },
      { blockId: "long", title: "O que poderíamos ter feito diferente?", required: false },
    ],
  },
  Churn: {
    name: "Churn Survey",
    questions: [
      { blockId: "choice", title: "Qual o principal motivo do cancelamento?", required: true, config: { options: ["Preço", "Faltou funcionalidade", "Pouco uso", "Suporte", "Mudei de ferramenta"] } },
      { blockId: "long", title: "O que faria você reconsiderar?", required: false },
    ],
  },
  Feature: {
    name: "Feedback de Funcionalidade",
    questions: [
      { blockId: "stars", title: "O quanto você gostou da nova funcionalidade?", required: true, config: { max: 5 } },
      { blockId: "long", title: "O que você mudaria nela?", required: false },
    ],
  },
  Beta: {
    name: "Beta Feedback",
    questions: [
      { blockId: "csat", title: "Qual sua impressão geral sobre o beta?", required: true, config: { min: 1, max: 5 } },
      { blockId: "long", title: "Encontrou algum problema? Descreva.", required: false },
    ],
  },
  Personalizada: {
    name: "Pesquisa personalizada",
    questions: [
      { blockId: "short", title: "Sua primeira pergunta", required: false, config: { placeholder: "Digite a resposta" } },
    ],
  },
};
