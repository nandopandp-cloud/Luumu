/*
  Avaliação de condições (segmentação do tour e condições por passo). PURO.
  Só compara valores — nunca executa nada vindo da configuração (sem eval).
*/
import type { Rule, TourAudience } from "./types";
import { routeMatches } from "./target";

export interface ConditionContext {
  /** traits informados via Luumu.identify({...}) */
  user: Record<string, unknown>;
  route: string;
  host: string;
  /** primeira visita deste navegador ao produto (base do público "novos usuários") */
  isNewUser: boolean;
}

function read(field: string, ctx: ConditionContext): unknown {
  if (field === "route") return ctx.route;
  if (field === "host") return ctx.host;
  if (field.startsWith("user.")) {
    let cur: unknown = ctx.user;
    for (const part of field.slice(5).split(".")) {
      if (!cur || typeof cur !== "object") return undefined;
      cur = (cur as Record<string, unknown>)[part];
    }
    return cur;
  }
  return undefined;
}

const asText = (v: unknown) => (v === undefined || v === null ? "" : String(v)).trim().toLowerCase();

export function evaluateRule(rule: Rule, ctx: ConditionContext): boolean {
  const actual = read(rule.field, ctx);
  const expected = rule.value ?? "";
  switch (rule.op) {
    case "exists":
      return actual !== undefined && actual !== null && actual !== "";
    case "not_exists":
      return actual === undefined || actual === null || actual === "";
    case "eq":
      // rota compara como padrão de rota ("/projects/:id"), o resto como texto
      return rule.field === "route" ? routeMatches(expected, ctx.route) : asText(actual) === asText(expected);
    case "neq":
      return rule.field === "route" ? !routeMatches(expected, ctx.route) : asText(actual) !== asText(expected);
    case "contains":
      if (Array.isArray(actual)) return actual.map(asText).includes(asText(expected));
      return asText(actual).includes(asText(expected));
    case "gt":
    case "lt": {
      const a = Number(actual);
      const b = Number(expected);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
      return rule.op === "gt" ? a > b : a < b;
    }
    default:
      return false;
  }
}

export function evaluateRules(rules: Rule[], ctx: ConditionContext, match: "all" | "any" = "all"): boolean {
  if (!rules.length) return true;
  return match === "all" ? rules.every((r) => evaluateRule(r, ctx)) : rules.some((r) => evaluateRule(r, ctx));
}

export function matchesAudience(aud: TourAudience, ctx: ConditionContext): boolean {
  if (aud.mode === "new") return ctx.isNewUser && evaluateRules(aud.rules, ctx, aud.match);
  if (aud.mode === "existing") return !ctx.isNewUser && evaluateRules(aud.rules, ctx, aud.match);
  if (aud.mode === "rules") return evaluateRules(aud.rules, ctx, aud.match);
  return true;
}

export const RULE_FIELD_PRESETS: { value: string; label: string }[] = [
  { value: "user.plan", label: "Plano do usuário" },
  { value: "user.role", label: "Cargo / papel" },
  { value: "user.email", label: "E-mail" },
  { value: "user.company", label: "Empresa" },
  { value: "route", label: "Página atual" },
  { value: "host", label: "Plataforma" },
];

export const RULE_OP_LABEL: Record<Rule["op"], string> = {
  eq: "é igual a",
  neq: "é diferente de",
  contains: "contém",
  gt: "maior que",
  lt: "menor que",
  exists: "está preenchido",
  not_exists: "não está preenchido",
};
