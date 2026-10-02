import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateRule, evaluateRules, matchesAudience, type ConditionContext } from "../../lib/tours/conditions";
import { canShow } from "../../lib/tours/frequency";

const ctx: ConditionContext = {
  user: { plan: "Pro", role: "admin", company: { size: 80 }, tags: ["beta"], onboardingCompleted: false },
  route: "/projects/12",
  host: "app.cliente.com",
  isNewUser: true,
};

test("regras de usuário, rota e números", () => {
  assert.ok(evaluateRule({ field: "user.plan", op: "eq", value: "pro" }, ctx)); // sem diferenciar caixa
  assert.ok(evaluateRule({ field: "user.role", op: "neq", value: "viewer" }, ctx));
  assert.ok(evaluateRule({ field: "user.company.size", op: "gt", value: "50" }, ctx));
  assert.ok(!evaluateRule({ field: "user.company.size", op: "lt", value: "50" }, ctx));
  assert.ok(evaluateRule({ field: "user.onboardingCompleted", op: "eq", value: "false" }, ctx));
  assert.ok(evaluateRule({ field: "user.tags", op: "contains", value: "beta" }, ctx));
  assert.ok(evaluateRule({ field: "route", op: "eq", value: "/projects/:id" }, ctx));
  assert.ok(evaluateRule({ field: "user.missing", op: "not_exists" }, ctx));
  assert.ok(!evaluateRule({ field: "user.plan", op: "gt", value: "abc" }, ctx)); // não numérico = falso
});

test("combinação all/any e públicos", () => {
  const rules = [
    { field: "user.plan", op: "eq" as const, value: "free" },
    { field: "user.role", op: "eq" as const, value: "admin" },
  ];
  assert.ok(!evaluateRules(rules, ctx, "all"));
  assert.ok(evaluateRules(rules, ctx, "any"));
  assert.ok(matchesAudience({ mode: "new", match: "all", rules: [] }, ctx));
  assert.ok(!matchesAudience({ mode: "existing", match: "all", rules: [] }, ctx));
  assert.ok(!matchesAudience({ mode: "rules", match: "all", rules }, ctx));
});

test("frequência", () => {
  assert.ok(canShow("once", {}, false));
  assert.ok(!canShow("once", { started: 1 }, false));
  assert.ok(canShow("until_completed", { started: 1, dismissed: 1 }, false));
  assert.ok(!canShow("until_completed", { completed: 1 }, false));
  assert.ok(!canShow("until_dismissed", { dismissed: 1 }, false));
  assert.ok(!canShow("once_per_session", {}, true));
  assert.ok(canShow("always", { completed: 1 }, true));
  assert.ok(!canShow("always", { never: 1 }, false)); // "não mostrar novamente" vence tudo
});
