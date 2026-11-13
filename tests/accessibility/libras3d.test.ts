/*
  Intérprete Luumu (beta): leitura do pacote do dicionário do VLibras (UnityFS + árvore de tipos,
  lib/accessibility/libras3d/unity.ts), conversão para o formato que o intérprete toca (sign.ts) e
  as regras do visual configurado no painel (interpreters.ts + config.ts).

  Fixture: tests/fixtures/libras/OI.bundle, o sinal "OI" baixado de dicionario2.vlibras.gov.br.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lz4Block, readAnimationClip } from "@/lib/accessibility/libras3d/unity";
import { safeGloss, signFromBundle } from "@/lib/accessibility/libras3d/sign";
import { DEFAULT_LOOK, backgroundCss, logoPosition, normalizeLook } from "@/lib/accessibility/libras3d/interpreters";
import { normalizeA11yConfig, publicA11yConfig } from "@/lib/accessibility/config";

const OI = new Uint8Array(readFileSync(new URL("../fixtures/libras/OI.bundle", import.meta.url)));

test("lê o AnimationClip do pacote do VLibras", () => {
  const clip = readAnimationClip(OI);
  assert.equal(clip.m_Name, "OI");
  assert.equal(clip.m_Legacy, true);
  assert.equal((clip.m_RotationCurves as unknown[]).length, 84, "84 ossos do esqueleto de controle");
  assert.ok((clip.m_FloatCurves as { attribute: string }[]).some((c) => c.attribute === "blendShape.Sorriso"), "expressões faciais");
});

test("converte o sinal: 30 quadros/s, dedos em movimento e expressões", () => {
  const s = signFromBundle(OI);
  assert.equal(s.fps, 30);
  assert.ok(Math.abs(s.duration - 2.1333) < 1e-3);
  const frames = Math.round(s.duration * 30) + 1;
  assert.equal(s.rot["BnMao.R"].length, frames, "a mão direita se move a cada quadro");
  assert.equal(s.rot["BnDedo.1.R.002"].length, frames, "dedos também");
  assert.equal(s.rot["BnBacia.001"].length, 1, "osso parado guarda um só valor");
  for (const q of s.rot["BnMao.R"]) assert.ok(Math.abs(Math.hypot(...q) - 1) < 1e-3, "quatérnios normalizados");
  assert.deepEqual(Object.keys(s.face).sort(), ["Bico", "LevantaSobrancelhaDir", "LevantaSobrancelhaEsq", "Sorriso"]);
  // valor de referência (mesmo cálculo em Python/UnityPy, validado no protótipo)
  const ref = [0.18314, 0.00805, -0.06415, 0.98096];
  s.rot["BnMao.R"][20].forEach((v, i) => assert.ok(Math.abs(v - ref[i]) < 5e-4, `quadro 20, componente ${i}`));
});

test("pacote inválido gera erro, não um resultado errado", () => {
  assert.throws(() => readAnimationClip(new TextEncoder().encode("não é unity")), /UnityFS/);
  assert.throws(() => readAnimationClip(OI.subarray(0, 200)), /truncado|LZ4/);
});

test("LZ4: literais e cópia com sobreposição", () => {
  // "abcabcabcabc": 3 literais + cópia de 9 bytes a 3 de distância
  const src = Uint8Array.from([0x35, 97, 98, 99, 3, 0]);
  assert.equal(new TextDecoder().decode(lz4Block(src, 12)), "abcabcabcabc");
});

test("glosa aceita só o vocabulário do VLibras", () => {
  assert.equal(safeGloss("bom_dia"), "BOM_DIA");
  assert.equal(safeGloss("AÇÃO"), "AÇÃO");
  assert.equal(safeGloss("TUDO-BEM&2"), "TUDO-BEM&2");
  assert.equal(safeGloss("../etc"), "");
  assert.equal(safeGloss("<script>"), "");
  assert.equal(safeGloss("A".repeat(60)), "");
});

test("visual do intérprete: valores desconhecidos caem no padrão", () => {
  assert.deepEqual(normalizeLook(null), DEFAULT_LOOK);
  const l = normalizeLook({ interpreter: "zz", shirtColor: "azul", logo: "x", logoSpot: "lua", logoX: 99, logoY: -99, logoOpacity: 150, logoSize: 2, background: "neon", logoUrl: "javascript:alert(1)" });
  assert.equal(l.interpreter, DEFAULT_LOOK.interpreter);
  assert.equal(l.shirtColor, DEFAULT_LOOK.shirtColor);
  assert.equal(l.logo, "brand");
  assert.equal(l.logoSpot, "auto");
  assert.equal(l.logoX, 14);
  assert.equal(l.logoY, -18);
  assert.equal(l.logoOpacity, 100);
  assert.equal(l.logoSize, 7);
  assert.equal(l.background, "lavanda");
  assert.equal(l.logoUrl, "");
  assert.equal(normalizeLook({ shirtColor: "" }).shirtColor, "", "vazio = cor original");
  assert.equal(normalizeLook({ background: "#abcdef" }).background, "#ABCDEF");
});

test("posição do logo e fundo", () => {
  assert.equal(logoPosition({ logoSpot: "auto", logoX: 3, logoY: 3 }), null);
  assert.deepEqual(logoPosition({ logoSpot: "esquerdo", logoX: 0, logoY: 0 }), { x: 8, y: 1 });
  assert.deepEqual(logoPosition({ logoSpot: "custom", logoX: -5, logoY: 4 }), { x: -5, y: 4 });
  assert.match(backgroundCss("menta"), /gradient/);
  assert.equal(backgroundCss("#112233"), "#112233");
  assert.match(backgroundCss("??"), /gradient/, "inválido volta para lavanda");
});

test("configuração: VLibras continua o padrão; o intérprete Luumu chega ao navegador", () => {
  assert.equal(normalizeA11yConfig({}).libras.engine, "vlibras");
  const c = normalizeA11yConfig({ libras: { engine: "luumu", look: { interpreter: "jm2", background: "marinho" } } });
  assert.equal(c.libras.engine, "luumu");
  const pub = publicA11yConfig(c);
  assert.equal(pub.libras.engine, "luumu");
  assert.equal(pub.libras.look.interpreter, "jm2");
  assert.equal(normalizeA11yConfig({ libras: { engine: "outro" } }).libras.engine, "vlibras");
});
