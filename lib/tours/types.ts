/*
  Contratos do Luumu Product Tours. Módulo PURO: importado pelo painel (React), pelo
  servidor e pelos bundles do SDK (esbuild). Não importar nada de DOM, banco ou Node aqui.
  Ver docs/tours/ARQUITETURA.md.
*/

export const STEP_TYPES = ["modal", "tooltip", "popover", "spotlight"] as const;
export type StepType = (typeof STEP_TYPES)[number];

export const PLACEMENTS = [
  "auto",
  "center",
  "top",
  "top-start",
  "top-end",
  "bottom",
  "bottom-start",
  "bottom-end",
  "left",
  "left-start",
  "left-end",
  "right",
  "right-start",
  "right-end",
] as const;
export type Placement = (typeof PLACEMENTS)[number];

export const DEVICES = ["desktop", "tablet", "mobile"] as const;
export type Device = (typeof DEVICES)[number];

/** Larguras de viewport que separam os dispositivos (mesmos valores no runtime e no preview). */
export const BREAKPOINTS = { mobile: 640, tablet: 1024 } as const;

/** Estratégia que melhor identifica o alvo, da mais estável para a mais frágil. */
export const TARGET_STRATEGIES = [
  "luumu-id",
  "element-id",
  "test-id",
  "aria-label",
  "text",
  "path",
  "fingerprint",
  "selector",
] as const;
export type TargetStrategy = (typeof TARGET_STRATEGIES)[number];

export type ElementKind = "button" | "link" | "navigation" | "input" | "select" | "tab" | "menu" | "card" | "other";

/**
 * Descritor resiliente de um elemento do produto do cliente (TourStepTarget).
 * Várias estratégias juntas — a resolução pontua os candidatos em vez de confiar num seletor.
 */
export interface ElementTarget {
  luumuId?: string; // data-luumu-id: prioridade absoluta
  elementId?: string; // id estável
  testId?: string; // data-testid | data-test | data-cy
  ariaLabel?: string;
  role?: string;
  tag: string;
  text?: string; // texto visível curto, normalizado
  name?: string; // atributo name (inputs)
  href?: string; // pathname do link
  classes?: string[]; // só classes estáveis
  path?: string; // caminho semântico curto (landmark > ... > tag)
  selector?: string; // fallback
  fingerprint: string;
  strategy: TargetStrategy;
  stability: number; // 0–1
  /** rótulo legível para o painel (data-luumu-name, aria-label ou texto) */
  label: string;
  kind: ElementKind;
  description?: string; // data-luumu-description
}

export interface StepDeviceConfig {
  placement?: Placement;
  /** largura do card em px; null = automático (no mobile, largura da tela - 32px) */
  width?: number | null;
}

export type StepActionType = "none" | "navigate" | "open_url" | "track";
export interface StepAction {
  type: StepActionType;
  value?: string; // rota, URL ou nome do evento
  newTab?: boolean;
}

export type RuleOp = "eq" | "neq" | "contains" | "gt" | "lt" | "exists" | "not_exists";
/** Condição (TourCondition) sobre o usuário identificado, a rota ou a plataforma. */
export interface Rule {
  /** "user.plan", "user.role", "user.<trait>", "route", "host" */
  field: string;
  op: RuleOp;
  value?: string;
}

export interface TourStep {
  key: string; // estável entre versões
  type: StepType;
  enabled: boolean;
  title: string;
  body: string;
  imageUrl?: string;
  /** rota onde o passo acontece ("/projects", aceita ":param" e "*"); null = qualquer */
  route: string | null;
  target: ElementTarget | null; // modal não precisa
  placement: Placement;
  responsive: Partial<Record<Device, StepDeviceConfig>>;
  buttons: { next: string; back: string; skip: string; showBack: boolean; showSkip: boolean };
  /** como o passo avança: botão "Próximo" ou clique no próprio elemento */
  advance: "button" | "click_target";
  /** destaque do alvo em tooltip/popover (spotlight sempre escurece o resto) */
  highlight: "none" | "ring" | "spotlight";
  scroll: { enabled: boolean; behavior: "smooth" | "instant"; block: "center" | "start" | "end" | "nearest" };
  /** se o alvo não aparecer: pular o passo (padrão) ou encerrar o tour */
  onMissing: "skip" | "end";
  waitTimeoutMs: number;
  /** executada ao avançar deste passo (whitelist) */
  action: StepAction;
  conditions: Rule[];
}

export type TriggerType = "first_access" | "page_load" | "event" | "manual";
/** TourTrigger */
export interface TourTrigger {
  type: TriggerType;
  event?: string; // quando type = event
  route?: string | null; // só inicia nesta rota (opcional)
  delaySec: number;
}

export type Frequency = "once" | "once_per_session" | "until_completed" | "until_dismissed" | "always";

/** TourSegment */
export interface TourAudience {
  mode: "all" | "new" | "existing" | "rules";
  match: "all" | "any";
  rules: Rule[];
}

export type TourTheme = "luumu" | "minimal" | "dark" | "custom";
export interface TourAppearance {
  theme: TourTheme;
  accent: string;
  progress: "count" | "dots" | "none";
  allowDismiss: boolean; // botão fechar + ESC
  dontShowAgain: boolean; // link "Não mostrar novamente"
  backdropOpacity: number; // 0–0.8, para modal e spotlight
  radius: number; // px
  confetti: boolean; // confete ao concluir o tour
}

export interface TourSettings {
  trigger: TourTrigger;
  frequency: Frequency;
  audience: TourAudience;
  targetHosts: string[]; // [] = todas as plataformas do projeto
  /** endereço base para abrir o produto no builder/preview, ex.: https://app.cliente.com/dashboard */
  startUrl: string;
  appearance: TourAppearance;
}

/** O que o /config anuncia sobre cada tour publicado (sem os passos). */
export interface TourCatalogEntry {
  id: string;
  v: number; // versão publicada
  trigger: TourTrigger;
  frequency: Frequency;
  audience: TourAudience;
}

/** Tour completo servido ao runtime. */
export interface TourPayload {
  id: string;
  v: number; // 0 = rascunho (preview)
  versionId: string;
  name: string;
  settings: TourSettings;
  steps: TourStep[];
}

export const TOUR_EVENT_TYPES = [
  "tour_viewed",
  "tour_started",
  "tour_step_viewed",
  "tour_step_completed",
  "tour_step_skipped",
  "tour_completed",
  "tour_dismissed",
  "tour_error",
  "tour_target_not_found",
] as const;
export type TourEventType = (typeof TOUR_EVENT_TYPES)[number];

export interface TourEventInput {
  type: TourEventType;
  tourId: string;
  versionId?: string | null;
  stepKey?: string | null;
  userId?: string | null;
  anonymousId?: string | null;
  sessionId?: string | null;
  route?: string | null;
  ts?: number;
  meta?: Record<string, string | number | boolean | null>;
}

/** Elemento descoberto pelo Product Discovery Engine (ProductElement). */
export interface DiscoveredElement {
  target: ElementTarget;
  rect: { x: number; y: number; width: number; height: number };
}
