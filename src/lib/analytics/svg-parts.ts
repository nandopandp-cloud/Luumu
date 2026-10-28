import "server-only";
import { createHash } from "node:crypto";

/*
  Avatar desenhado guardado em peças. Os personagens montados (Geniex) repetem as mesmas peças —
  rosto, olhos, boca, cabelo, ~2 KB de traçado cada — em milhares de alunos, mas cada aluno (e cada
  tamanho de tela, que muda as posições) gera um desenho com impressão própria: guardado inteiro,
  eram ~27 KB por desenho e 2 GB no banco em 10/2026. Aqui cada traçado grande vira uma peça
  guardada uma vez por projeto, e o desenho guarda só a "receita" (o SVG com uma marca no lugar de
  cada peça). Remontar devolve o texto idêntico ao desenho limpo. Só servidor (node:crypto).
*/

/** Marca de peça na receita: caractere de uso privado + impressão da peça (16 hex). */
const MARK = "";
const MARK_RE = /([0-9a-f]{16})/g;
/** Traçados menores ficam na receita: a marca e a linha da peça custariam mais que eles. */
const PART_MIN = 200;

export interface SvgParts {
  recipe: string;
  parts: { hash: string; body: string }[];
}

/**
 * Separa o desenho (já limpo por sanitizeSvg) em receita + peças. A marca é tirada do desenho
 * antes: um SVG enviado com marcas próprias não consegue puxar peça de outro desenho.
 */
export function splitSvgParts(svg: string): SvgParts {
  const parts = new Map<string, string>();
  const recipe = svg.replace(//g, "").replace(/<path\b[^>]*?(?:\/>|>\s*<\/path>)/g, (el) => {
    if (el.length < PART_MIN) return el;
    const hash = createHash("sha256").update(el).digest("hex").slice(0, 16);
    parts.set(hash, el);
    return MARK + hash;
  });
  return { recipe, parts: Array.from(parts, ([hash, body]) => ({ hash, body })) };
}

/** Impressões das peças que a receita usa (vazio para desenho guardado inteiro, o formato antigo). */
export function partHashes(recipe: string): string[] {
  return Array.from(new Set(Array.from(recipe.matchAll(MARK_RE), (m) => m[1])));
}

/** Remonta o desenho. null se faltar alguma peça. */
export function joinSvgParts(recipe: string, parts: Map<string, string>): string | null {
  let missing = false;
  const svg = recipe.replace(MARK_RE, (_, hash: string) => {
    const body = parts.get(hash);
    if (body === undefined) missing = true;
    return body ?? "";
  });
  return missing ? null : svg;
}
