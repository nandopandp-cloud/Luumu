import type { StepType, TourAppearance, TourSettings, TourStep } from "./types";

/** Chave estável de um passo (sobrevive entre versões; usada no funil do analytics). */
export function newStepKey(): string {
  return `stp_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export const DEFAULT_APPEARANCE: TourAppearance = {
  theme: "luumu",
  accent: "#6B2BD9",
  progress: "count",
  allowDismiss: true,
  dontShowAgain: false,
  backdropOpacity: 0.45,
  radius: 18,
  confetti: true,
};

export function defaultSettings(startUrl = ""): TourSettings {
  return {
    trigger: { type: "first_access", route: null, delaySec: 1 },
    frequency: "until_dismissed",
    audience: { mode: "all", match: "all", rules: [] },
    targetHosts: [],
    startUrl,
    appearance: { ...DEFAULT_APPEARANCE },
  };
}

const COPY: Record<StepType, { title: string; body: string }> = {
  modal: {
    title: "Olá! Vamos conhecer a plataforma?",
    body: "Preparamos um tour rápido para mostrar as principais funcionalidades.",
  },
  tooltip: { title: "Seu dashboard está aqui", body: "Acompanhe os principais indicadores em um único lugar." },
  popover: { title: "Crie seu primeiro projeto", body: "Clique aqui para começar." },
  spotlight: { title: "Dê uma olhada aqui", body: "Este é um dos recursos mais importantes do produto." },
};

export function defaultStep(type: StepType, overrides: Partial<TourStep> = {}): TourStep {
  return {
    key: newStepKey(),
    type,
    enabled: true,
    title: COPY[type].title,
    body: COPY[type].body,
    route: null,
    target: null,
    placement: type === "modal" ? "center" : "auto",
    responsive: { mobile: { placement: type === "modal" ? "center" : "bottom", width: null } },
    buttons: { next: "Próximo", back: "Voltar", skip: "Pular tour", showBack: true, showSkip: false },
    advance: "button",
    highlight: type === "spotlight" ? "spotlight" : type === "modal" ? "none" : "ring",
    scroll: { enabled: true, behavior: "smooth", block: "center" },
    onMissing: "skip",
    waitTimeoutMs: 6000,
    action: { type: "none" },
    conditions: [],
    ...overrides,
  };
}

/** Passos com que um tour novo nasce: boas-vindas e conclusão, o miolo é do usuário. */
export function starterSteps(): TourStep[] {
  return [
    defaultStep("modal", { buttons: { next: "Começar tour", back: "Agora não", skip: "Pular tour", showBack: false, showSkip: true } }),
    defaultStep("modal", {
      title: "Pronto! 🎉",
      body: "Agora você já conhece os principais recursos da plataforma.",
      buttons: { next: "Começar a usar", back: "Voltar", skip: "Pular tour", showBack: true, showSkip: false },
    }),
  ];
}

export const STEP_TYPE_LABEL: Record<StepType, string> = {
  modal: "Modal",
  tooltip: "Tooltip com destaque",
  popover: "Popover",
  spotlight: "Spotlight",
};

export const STEP_TYPE_HINT: Record<StepType, string> = {
  modal: "Centralizado, sem elemento alvo",
  tooltip: "Balão ligado a um elemento",
  popover: "Card flutuante ao lado do elemento",
  spotlight: "Escurece tudo menos o elemento",
};
