/*
  Ordenação de tabelas: comparação estável para números, datas e textos (pt-BR, sem
  diferenciar acento/caixa). Vazios (null/undefined/NaN) vão SEMPRE para o fim, nos dois
  sentidos — "sem dado" não é o maior nem o menor valor. PURO e testado.
*/
export type SortDir = "asc" | "desc";
export type SortValue = string | number | Date | null | undefined;

const collator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

function norm(v: SortValue): string | number | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.getTime();
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  return v.trim() === "" ? null : v;
}

export function compareValues(a: SortValue, b: SortValue, dir: SortDir): number {
  const x = norm(a);
  const y = norm(b);
  if (x === null && y === null) return 0;
  if (x === null) return 1;
  if (y === null) return -1;
  const c = typeof x === "number" && typeof y === "number" ? x - y : collator.compare(String(x), String(y));
  return dir === "asc" ? c : -c;
}

/** Ordena uma cópia; empates mantêm a ordem original (estável). */
export function sortRows<T>(rows: T[], get: (r: T) => SortValue, dir: SortDir): T[] {
  return rows
    .map((r, i) => ({ r, i }))
    .sort((p, q) => compareValues(get(p.r), get(q.r), dir) || p.i - q.i)
    .map((x) => x.r);
}

/** Primeiro clique: números e datas do maior para o menor; textos de A a Z. */
export function firstDir(sample: SortValue): SortDir {
  return typeof sample === "string" ? "asc" : "desc";
}
