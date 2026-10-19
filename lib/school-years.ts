/**
 * Segmentação de pesquisas por ano escolar.
 *
 * Módulo puro: usado pelo painel (seleção), pelo servidor (sanitização) e pelo SDK
 * (decide se o usuário atual está no público). O produto informa o ano do usuário com
 *   Luumu.identify({ ..., school_year: "7º ano" })   // ou grade_level: "fundamental_2"
 * e a pesquisa guarda os códigos canônicos dos anos escolhidos ("EF7", "EM1"...).
 */

export type SegmentId = "fundamental_1" | "fundamental_2" | "ensino_medio";

export interface SchoolYear {
  code: string;
  label: string;
  segment: SegmentId;
}

export const SEGMENTS: { id: SegmentId; label: string }[] = [
  { id: "fundamental_1", label: "Fundamental I" },
  { id: "fundamental_2", label: "Fundamental II" },
  { id: "ensino_medio", label: "Ensino Médio" },
];

export const SCHOOL_YEARS: SchoolYear[] = [
  ...[1, 2, 3, 4, 5].map((n) => ({ code: `EF${n}`, label: `${n}º ano`, segment: "fundamental_1" as const })),
  ...[6, 7, 8, 9].map((n) => ({ code: `EF${n}`, label: `${n}º ano`, segment: "fundamental_2" as const })),
  ...[1, 2, 3].map((n) => ({ code: `EM${n}`, label: `${n}ª série`, segment: "ensino_medio" as const })),
];

const ORDER = SCHOOL_YEARS.map((y) => y.code);

export const yearsOfSegment = (segment: SegmentId) =>
  SCHOOL_YEARS.filter((y) => y.segment === segment).map((y) => y.code);

/** Mantém só códigos conhecidos, sem repetição, na ordem escolar. */
export function normalizeSchoolYears(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const set = new Set(input.map((x) => String(x).trim().toUpperCase()));
  return ORDER.filter((c) => set.has(c));
}

/** Resumo legível da seleção: "Fundamental II, 1ª série (EM)". [] = todos. */
export function schoolYearsLabel(codes: string[]): string {
  if (codes.length === 0) return "Todos os anos";
  const parts: string[] = [];
  for (const seg of SEGMENTS) {
    const all = yearsOfSegment(seg.id);
    const picked = all.filter((c) => codes.includes(c));
    if (picked.length === 0) continue;
    if (picked.length === all.length) parts.push(seg.label);
    else
      parts.push(
        ...picked.map((c) => {
          const y = SCHOOL_YEARS.find((s) => s.code === c)!;
          return seg.id === "ensino_medio" ? `${y.label} (EM)` : y.label;
        })
      );
  }
  return parts.join(", ");
}

const norm = (v: unknown) =>
  String(v)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[_\-./]+/g, " ")
    .trim();

/**
 * Lê o ano escolar como o produto mandar: "EF7", "7", 7, "7º ano", "7 ano fundamental",
 * "EM1", "1EM", "1ª série do ensino médio", "1 medio". Números 10–12 viram 1ª–3ª série (EM).
 * Sem menção a médio/EM, o número é ano do Fundamental.
 */
export function parseSchoolYear(raw: unknown): string | null {
  if (raw === null || raw === undefined || typeof raw === "boolean") return null;
  const s = norm(raw);
  const num = s.match(/\d{1,2}/);
  if (!num) return null;
  const n = Number(num[0]);
  const isEM = /\bem\b|medio|\d\s*em\b|\bem\s*\d/.test(s);
  if (isEM) return n >= 1 && n <= 3 ? `EM${n}` : null;
  if (n >= 1 && n <= 9) return `EF${n}`;
  if (n >= 10 && n <= 12) return `EM${n - 9}`;
  return null;
}

/** Lê o segmento: "fundamental_1", "Fundamental I", "anos iniciais", "EF2", "ensino_medio", "EM"... */
export function parseGradeLevel(raw: unknown): SegmentId | null {
  if (raw === null || raw === undefined || typeof raw === "boolean") return null;
  const s = norm(raw);
  if (/medio|^em$|high/.test(s)) return "ensino_medio";
  if (/finais|(fundamental|^ef|^f)\s*(ii|2)\b/.test(s)) return "fundamental_2";
  if (/iniciais|(fundamental|^ef|^f)\s*(i|1)\b/.test(s)) return "fundamental_1";
  return null;
}

/**
 * Ano escolar mostrado na tela do produto como "GRADE_N" (Exploradores: o perfil do aluno
 * traz "6º ANO B • GRADE_6"). Só vale se a página mostrar UM ano: vários valores distintos
 * (lista de turmas, ranking) não dizem qual é o do usuário.
 */
export function gradeFromTexts(texts: string[]): string | null {
  const found = new Set<string>();
  const re = /\bGRADE_(\d{1,2})\b/gi;
  for (const t of texts) {
    re.lastIndex = 0;
    for (let m = re.exec(t); m; m = re.exec(t)) {
      const year = parseSchoolYear(m[1]);
      if (year) found.add(year);
    }
  }
  return found.size === 1 ? [...found][0] : null;
}

const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === undefined || v === null || v === "" ? [] : [v]);

/**
 * O usuário (traits do identify) está entre os anos escolhidos? [] = sem filtro.
 * Usa `school_year` (um valor ou lista, p.ex. professor com várias turmas); sem ele,
 * aceita `grade_level` quando a pesquisa cobre o segmento inteiro. Sem nenhum dos
 * dois, o usuário fica de fora: não dá para saber se ele é do público.
 */
export function matchesSchoolYears(selected: string[] | null | undefined, traits: Record<string, unknown>): boolean {
  const wanted = normalizeSchoolYears(selected ?? []);
  if (wanted.length === 0) return true;

  const years = list(traits.school_year ?? traits.schoolYear).map(parseSchoolYear).filter(Boolean) as string[];
  if (years.length) return years.some((y) => wanted.includes(y));

  const segments = list(traits.grade_level ?? traits.gradeLevel).map(parseGradeLevel).filter(Boolean) as SegmentId[];
  return segments.some((seg) => yearsOfSegment(seg).every((c) => wanted.includes(c)));
}
