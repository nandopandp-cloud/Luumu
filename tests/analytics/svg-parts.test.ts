/*
  Avatar desenhado guardado em peças: a receita + as peças remontam o desenho exatamente, e
  desenhos diferentes do mesmo personagem compartilham as peças.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { joinSvgParts, partHashes, splitSvgParts } from "@/lib/analytics/svg-parts";

const trace = (seed: number) => `M${seed} 75.2595C347.822 75.2595 406.552 119.272 427.366 ${"147.1 ".repeat(40)}Z`;
const head = `<path fill-rule="evenodd" clip-rule="evenodd" d="${trace(291)}" fill="var(--skin)" style="fill:rgb(174, 93, 41)"></path>`;
const eyes = `<path d="${trace(93)}" fill="black"/>`;
const tiny = `<path d="M1 1h2"></path>`;

/** Mesmo personagem em outra tela: só posições mudam. */
const avatar = (x: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="8.2 2.6 22.7 22.7">` +
  `<svg viewBox="0 0 542 567" x="${x}" y="5.3"> ${head} ${tiny}</svg><svg viewBox="0 0 289 293" x="17.5" y="10.9"> ${eyes} </svg></svg>`;

const remount = (svg: string) => {
  const { recipe, parts } = splitSvgParts(svg);
  return joinSvgParts(recipe, new Map(parts.map((x) => [x.hash, x.body])));
};

test("remonta exatamente o desenho", () => {
  for (const svg of [avatar(11.2), avatar(14.6)]) assert.equal(remount(svg), svg);
});

test("traçados grandes viram peças compartilhadas; pequenos ficam na receita", () => {
  const a = splitSvgParts(avatar(11.2));
  const b = splitSvgParts(avatar(14.6));
  assert.equal(a.parts.length, 2);
  assert.deepEqual(a.parts.map((x) => x.hash), b.parts.map((x) => x.hash));
  assert.ok(a.recipe.includes(tiny));
  assert.ok(!a.recipe.includes(trace(291)));
  assert.ok(a.recipe.length < avatar(11.2).length / 3);
  assert.deepEqual(partHashes(a.recipe), a.parts.map((x) => x.hash));
});

test("desenho sem traçado grande (formato antigo ou só imagem) passa intacto", () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/webp;base64,AAAA"/>${tiny}</svg>`;
  const { recipe, parts } = splitSvgParts(svg);
  assert.equal(recipe, svg);
  assert.equal(parts.length, 0);
  assert.deepEqual(partHashes(svg), []);
  assert.equal(joinSvgParts(svg, new Map()), svg);
});

test("falta de peça não devolve desenho pela metade", () => {
  const { recipe } = splitSvgParts(avatar(11.2));
  assert.equal(joinSvgParts(recipe, new Map()), null);
});

test("marca forjada no desenho enviado não puxa peça de outro desenho", () => {
  const { parts } = splitSvgParts(avatar(11.2));
  const forged = `<svg>${parts[0].hash}</svg>`;
  const split = splitSvgParts(forged);
  assert.equal(split.recipe, `<svg>${parts[0].hash}</svg>`);
  assert.deepEqual(partHashes(split.recipe), []);
});
