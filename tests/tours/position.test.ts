import { test } from "node:test";
import assert from "node:assert/strict";
import { computePosition, resolveSide } from "../../lib/tours/position";

const vp = { width: 1280, height: 800 };
const card = { width: 340, height: 180 };

test("bottom: card abaixo do alvo, centralizado", () => {
  const anchor = { x: 500, y: 100, width: 100, height: 40 };
  const p = computePosition(anchor, card, vp, "bottom", { offset: 12, margin: 12 });
  assert.equal(p.side, "bottom");
  assert.equal(p.y, 152);
  assert.equal(p.x, 550 - 170);
  assert.equal(p.arrow, 170); // seta aponta para o centro do alvo
});

test("flip: sem espaço acima, vai para baixo", () => {
  const anchor = { x: 500, y: 20, width: 100, height: 40 };
  assert.equal(resolveSide("top", anchor, card, vp, 24), "bottom");
});

test("auto: escolhe um lado que caiba (alvo no rodapé → acima)", () => {
  const anchor = { x: 500, y: 740, width: 100, height: 40 };
  const p = computePosition(anchor, card, vp, "auto");
  assert.equal(p.side, "top");
});

test("clamp: nunca sai da tela, mesmo com alvo na borda", () => {
  const anchor = { x: 1250, y: 300, width: 30, height: 30 };
  const p = computePosition(anchor, card, vp, "bottom-start", { margin: 12 });
  assert.ok(p.x + card.width <= vp.width - 12);
  assert.ok(p.x >= 12);
  assert.ok(p.arrow! >= 18 && p.arrow! <= card.width - 18);
});

test("start/end alinham com a borda do alvo", () => {
  const anchor = { x: 400, y: 100, width: 200, height: 40 };
  assert.equal(computePosition(anchor, card, vp, "bottom-start").x, 400);
  assert.equal(computePosition(anchor, card, vp, "bottom-end").x, 600 - 340);
});

test("left/right posicionam ao lado", () => {
  const anchor = { x: 600, y: 300, width: 100, height: 40 };
  const r = computePosition(anchor, card, vp, "right", { offset: 10 });
  assert.equal(r.side, "right");
  assert.equal(r.x, 710);
  const l = computePosition(anchor, card, vp, "left", { offset: 10 });
  assert.equal(l.x, 600 - 10 - 340);
});

test("center e alvo ausente centralizam sem seta", () => {
  const p = computePosition(null, card, vp, "bottom");
  assert.equal(p.side, "center");
  assert.equal(p.arrow, null);
  assert.equal(p.x, (1280 - 340) / 2);
});

test("mobile: card mais largo que a tela fica preso à margem", () => {
  const small = { width: 390, height: 700 };
  const p = computePosition({ x: 20, y: 600, width: 60, height: 40 }, { width: 358, height: 200 }, small, "bottom");
  assert.ok(p.x >= 12 && p.x + 358 <= 390 - 12 + 0.001);
  assert.equal(p.side, "top"); // sem espaço abaixo
});
