/*
  Catálogo de planos da Luumu — FONTE ÚNICA de preços, limites, recursos e da tabela de
  comparação. Usado pela área Plano & Cobrança, pelos limites de uso (lib/db/workspace.ts) e
  pelo card de plano da sidebar. PURO.

  `soon: true` marca recurso que ainda não está disponível na plataforma: ele aparece com o
  selo "Em breve" — não vendemos o que não existe.
*/

export const PLAN_IDS = ["free", "starter", "growth", "scale", "enterprise"] as const;
export type PlanId = (typeof PLAN_IDS)[number];
export type BillingCycle = "monthly" | "annual";

/** Desconto do plano anual. */
export const ANNUAL_DISCOUNT = 0.2;

export interface PlanFeature {
  label: string;
  included: boolean;
  soon?: boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  /** preço mensal em reais; null = sob consulta */
  monthly: number | null;
  popular?: boolean;
  limits: { responses: number; sessions: number; activeSurveys: number; members: number; retentionDays: number };
  features: PlanFeature[];
  cta: string;
}

const UNLIMITED = Infinity;

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Para experimentar o Luumu.",
    monthly: 0,
    limits: { responses: 100, sessions: 0, activeSurveys: 1, members: 1, retentionDays: 30 },
    features: [
      { label: "100 respostas/mês", included: true },
      { label: "1 pesquisa ativa", included: true },
      { label: "Dashboards básicos", included: true },
      { label: "Retenção de 30 dias", included: true },
      { label: "Heatmaps e Session Replay", included: false },
      { label: "Insights IA", included: false },
      { label: "Product Tours", included: false },
      { label: "API e Webhooks", included: false },
    ],
    cta: "Começar grátis",
  },
  {
    id: "starter",
    name: "Starter",
    tagline: "Para começar a ouvir seus usuários.",
    monthly: 99,
    limits: { responses: 1_000, sessions: 10_000, activeSurveys: 3, members: 3, retentionDays: 90 },
    features: [
      { label: "1.000 respostas/mês", included: true },
      { label: "10.000 sessões analisadas/mês", included: true },
      { label: "3 pesquisas ativas", included: true },
      { label: "Heatmaps", included: true },
      { label: "Session Replay", included: true, soon: true },
      { label: "Insights IA (básico)", included: true },
      { label: "Product Tours (básico)", included: true },
      { label: "3 membros", included: true },
      { label: "Retenção de 90 dias", included: true },
    ],
    cta: "Fazer upgrade",
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "Para equipes que querem transformar feedback em decisões.",
    monthly: 299,
    popular: true,
    limits: { responses: 10_000, sessions: 50_000, activeSurveys: UNLIMITED, members: 10, retentionDays: 365 },
    features: [
      { label: "10.000 respostas/mês", included: true },
      { label: "50.000 sessões analisadas/mês", included: true },
      { label: "Pesquisas ilimitadas", included: true },
      { label: "Heatmaps", included: true },
      { label: "Session Replay", included: true, soon: true },
      { label: "Insights IA (completo)", included: true },
      { label: "Product Tours", included: true },
      { label: "10 membros", included: true },
      { label: "API e Webhooks", included: true, soon: true },
      { label: "Segmentação avançada", included: true },
      { label: "Retenção de 1 ano", included: true },
    ],
    cta: "Fazer upgrade",
  },
  {
    id: "scale",
    name: "Scale",
    tagline: "Para produtos com alto volume de usuários.",
    monthly: 699,
    limits: { responses: 80_000, sessions: 200_000, activeSurveys: UNLIMITED, members: 25, retentionDays: 730 },
    features: [
      { label: "80.000 respostas/mês", included: true },
      { label: "200.000 sessões analisadas/mês", included: true },
      { label: "Pesquisas ilimitadas", included: true },
      { label: "Heatmaps", included: true },
      { label: "Session Replay", included: true, soon: true },
      { label: "Insights IA (avançado)", included: true },
      { label: "Product Tours", included: true },
      { label: "25 membros", included: true },
      { label: "API e Webhooks", included: true, soon: true },
      { label: "Segmentação avançada", included: true },
      { label: "Retenção de 2 anos", included: true },
      { label: "SSO/SAML", included: true, soon: true },
    ],
    cta: "Fazer upgrade",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "Para organizações que precisam de escala e governança.",
    monthly: null,
    limits: { responses: UNLIMITED, sessions: UNLIMITED, activeSurveys: UNLIMITED, members: UNLIMITED, retentionDays: UNLIMITED },
    features: [
      { label: "Volume personalizado", included: true },
      { label: "Pesquisas ilimitadas", included: true },
      { label: "Heatmaps", included: true },
      { label: "Session Replay", included: true, soon: true },
      { label: "Insights IA (customizado)", included: true },
      { label: "Product Tours", included: true },
      { label: "Membros ilimitados", included: true },
      { label: "SSO/SAML", included: true, soon: true },
      { label: "Permissões avançadas", included: true },
      { label: "Retenção personalizada", included: true },
      { label: "Suporte dedicado", included: true },
      { label: "Onboarding e SLA", included: true },
      { label: "Contrato e DPA", included: true },
    ],
    cta: "Falar com vendas",
  },
];

export const PLAN_BY_ID = new Map(PLANS.map((p) => [p.id, p]));

/** O plano inclui heatmaps? (mesma regra da tabela de comparação) */
export function planAllowsHeatmaps(plan: Plan): boolean {
  return plan.limits.sessions > 0;
}

/** Plano gravado no workspace → plano do catálogo (valores antigos/desconhecidos caem no Growth). */
export function planOf(raw: string | null | undefined): Plan {
  const id = (raw ?? "").toLowerCase() as PlanId;
  return PLAN_BY_ID.get(id) ?? PLAN_BY_ID.get("growth")!;
}

/** Preço exibido por mês no ciclo escolhido (anual = com desconto). null = sob consulta. */
export function monthlyPrice(plan: Plan, cycle: BillingCycle): number | null {
  if (plan.monthly === null) return null;
  return cycle === "annual" ? Math.round(plan.monthly * (1 - ANNUAL_DISCOUNT)) : plan.monthly;
}

/** Total cobrado por ano no plano anual. */
export function annualTotal(plan: Plan): number | null {
  const m = monthlyPrice(plan, "annual");
  return m === null ? null : m * 12;
}

export function formatBRL(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function formatLimit(n: number): string {
  return n === Infinity ? "Ilimitado" : n.toLocaleString("pt-BR");
}

/** Início do mês de cobrança: dia 1 à meia-noite no fuso do workspace (padrão São Paulo), em UTC. */
export function monthStart(now = new Date(), timeZone = "America/Sao_Paulo"): Date {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit" }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")!.value);
  const m = Number(parts.find((p) => p.type === "month")!.value);
  // meia-noite local do dia 1: o offset de São Paulo é -03:00 (sem horário de verão desde 2019)
  const local = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const offsetMin = timeZone === "America/Sao_Paulo" ? 180 : 0;
  return new Date(local.getTime() + offsetMin * 60_000);
}

/* ---------- tabela "Compare os planos" ---------- */

export type CellValue = string | boolean;
export interface CompareRow {
  label: string;
  hint: string;
  soon?: boolean;
  values: Record<PlanId, CellValue>;
  /** mostrada só em "Ver todos os recursos" */
  extra?: boolean;
}

const row = (label: string, hint: string, v: CellValue[], opts: { soon?: boolean; extra?: boolean } = {}): CompareRow => ({
  label,
  hint,
  ...opts,
  values: Object.fromEntries(PLAN_IDS.map((id, i) => [id, v[i]])) as Record<PlanId, CellValue>,
});

export const COMPARE_ROWS: CompareRow[] = [
  row("Respostas/mês", "Respostas de pesquisa recebidas por mês, somando todos os projetos.", ["100", "1.000", "10.000", "80.000", "Personalizado"]),
  row("Sessões analisadas/mês", "Sessões (visitas ao seu produto) registradas pelos heatmaps.", ["—", "10.000", "50.000", "200.000", "Personalizado"]),
  row("Pesquisas ativas", "Pesquisas no ar ao mesmo tempo.", ["1", "3", "Ilimitadas", "Ilimitadas", "Ilimitadas"]),
  row("Heatmaps", "Mapas de cliques, movimento e rolagem das suas páginas.", [false, true, true, true, true]),
  row("Session Replay", "Reprodução das sessões dos usuários.", [false, true, true, true, true], { soon: true }),
  row("Insights IA", "Temas, recomendações e conversa com seus dados.", [false, "Básico", "Completo", "Avançado", "Customizado"]),
  row("Product Tours", "Tours guiados criados sem código.", [false, "Básico", true, true, true]),
  row("Membros", "Pessoas com acesso ao workspace.", ["1", "3", "10", "25", "Ilimitados"]),
  row("Retenção de dados", "Por quanto tempo respostas e eventos ficam disponíveis.", ["30 dias", "90 dias", "1 ano", "2 anos", "Personalizada"]),
  row("API e Webhooks", "Integração programática com seus sistemas.", [false, false, true, true, true], { soon: true }),
  row("Segmentação avançada", "Público por atributos do usuário (plano, cargo...).", [false, false, true, true, true], { extra: true }),
  row("SSO/SAML", "Login único corporativo.", [false, false, false, true, true], { extra: true, soon: true }),
  row("Permissões avançadas", "Acesso por projeto e papéis personalizados.", [false, false, false, false, true], { extra: true }),
  row("Suporte dedicado", "Atendimento com pessoa de referência.", [false, false, false, false, true], { extra: true }),
  row("Onboarding e SLA", "Implantação acompanhada e acordo de nível de serviço.", [false, false, false, false, true], { extra: true }),
  row("Contrato e DPA", "Contrato próprio e acordo de proteção de dados.", [false, false, false, false, true], { extra: true }),
];
