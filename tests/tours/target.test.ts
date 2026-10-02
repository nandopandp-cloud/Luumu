import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isStableClass,
  isStableId,
  normalizeText,
  routeMatches,
  scoreCandidate,
  fingerprintOf,
  bestStrategy,
  stabilityOf,
  MIN_SCORE,
} from "../../lib/tours/target";
import type { ElementTarget } from "../../lib/tours/types";

test("ids gerados por framework não são estáveis", () => {
  for (const id of [":r1:", "«r3»", "radix-:r2:", "headlessui-menu-button-3", "mui-123", "ember1234", "a1b2c3d4e5f6"]) {
    assert.equal(isStableId(id), false, id);
  }
  for (const id of ["create-project", "sidebar", "main_nav"]) assert.equal(isStableId(id), true, id);
});

test("classes de CSS-in-JS, módulos, estado e utilitárias são descartadas", () => {
  for (const c of ["sc-bdVaJa", "css-1x2y3z", "Button_root__x7f2a", "jsx-123456", "active", "is-open", "hover:bg-red", "md:flex", "mt-10", "aBcDeFgH"]) {
    assert.equal(isStableClass(c), false, c);
  }
  for (const c of ["sidebar-link", "btn-primary", "nav__item"]) assert.equal(isStableClass(c), true, c);
});

test("normalizeText ignora acento, caixa e espaços", () => {
  assert.equal(normalizeText("  Criar   Projeto "), "criar projeto");
  assert.equal(normalizeText("Relatórios"), "relatorios");
});

test("routeMatches: parâmetros, curinga e barra final", () => {
  assert.ok(routeMatches("/projects/:id", "/projects/42"));
  assert.ok(!routeMatches("/projects/:id", "/projects"));
  assert.ok(routeMatches("/projects/*", "/projects/42/settings"));
  assert.ok(routeMatches("/dashboard", "/dashboard/"));
  assert.ok(!routeMatches("/dashboard", "/dashboard/x"));
  assert.ok(routeMatches(null, "/qualquer"));
});

const base = (patch: Partial<ElementTarget> = {}): ElementTarget => ({
  tag: "button",
  text: "Criar projeto",
  ariaLabel: undefined,
  fingerprint: fingerprintOf({ tag: "button", text: "criar projeto" }),
  strategy: "text",
  stability: 0.7,
  label: "Criar projeto",
  kind: "button",
  ...patch,
});

test("data-luumu-id decide sozinho", () => {
  const t = base({ luumuId: "create-project" });
  assert.equal(scoreCandidate(t, { tag: "div", luumuId: "create-project" }), 1000);
  assert.equal(scoreCandidate(t, { tag: "button", text: "criar projeto", luumuId: "outro" }), -1000);
});

test("texto alterado ainda casa pelo aria-label + href", () => {
  const t = base({ tag: "a", text: "Projetos", ariaLabel: "Ir para projetos", href: "/projects", fingerprint: "x" });
  const s = scoreCandidate(t, { tag: "a", text: "meus projetos", ariaLabel: "Ir para projetos", href: "/projects" });
  assert.ok(s >= MIN_SCORE, `score ${s}`);
});

test("elemento parecido mas diferente fica abaixo do mínimo", () => {
  const t = base();
  const s = scoreCandidate(t, { tag: "button", text: "excluir projeto" });
  assert.ok(s < MIN_SCORE, `score ${s}`);
});

test("estratégia e estabilidade seguem a prioridade do briefing", () => {
  assert.equal(bestStrategy({ tag: "button", luumuId: "x", text: "a" }), "luumu-id");
  assert.equal(bestStrategy({ tag: "button", elementId: "save-btn" }), "element-id");
  assert.equal(bestStrategy({ tag: "button", elementId: ":r1:", ariaLabel: "Salvar" }), "aria-label");
  assert.equal(bestStrategy({ tag: "div" }), "fingerprint");
  assert.ok(stabilityOf({ tag: "button", luumuId: "x" }) > stabilityOf({ tag: "button", text: "a" }));
});
