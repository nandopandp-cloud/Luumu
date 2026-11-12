/**
 * Cor no formato do editor (#RRGGBB, maiúsculo). Aceita "#abc", "abc123", espaços.
 * "" = inválida. Módulo puro (painel e servidor).
 */
export function normalizeHexColor(input: unknown): string {
  if (typeof input !== "string") return "";
  let s = input.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(s)) s = s.split("").map((c) => c + c).join("");
  return /^[0-9a-f]{6}$/i.test(s) ? `#${s.toUpperCase()}` : "";
}
