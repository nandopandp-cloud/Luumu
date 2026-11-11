/**
 * Plugin de Acessibilidade — público do convite ("sua experiência pode ficar melhor...").
 *
 * Módulo PURO: o painel monta os grupos, o servidor sanitiza e confere a lista individual, e o
 * SDK decide, no navegador, se o estudante está num grupo.
 *
 * De onde vêm rede, escola e turma: o produto do cliente informa no identify, com o nome que
 * já usa (os apelidos abaixo cobrem português e inglês):
 *
 *   Luumu.identify({ id: "123", email: "...", rede: "Rede Estadual SP",
 *                    escola: "EE Prof. Ana Rosa", turma: "7º A", school_year: "7º ano" })
 *
 * Grupo = combinação (E) de redes, escolas, turmas e anos; dentro de cada campo vale
 * qualquer um dos valores (OU). Entre grupos também é OU. Ex.: [rede X] ou [escola Y + 7º A].
 *
 * Privacidade (LGPD): a lista INDIVIDUAL de estudantes sinalizados é dado sensível — indica
 * uma necessidade de acessibilidade de uma pessoa identificada. Ela nunca sai no /config
 * público: o SDK só sabe que a lista existe (`hasList`) e pergunta ao servidor por UM
 * estudante, o logado (POST /api/v1/accessibility/match). Os grupos são de turma/escola/rede
 * e não identificam ninguém, então seguem no /config e são avaliados no navegador.
 */
import { matchesSchoolYears, normalizeSchoolYears } from "../surveys/school-years";

export interface AudienceGroup {
  id: string;
  networks: string[];
  schools: string[];
  classes: string[];
  /** códigos canônicos de lib/surveys/school-years ("EF7", "EM1") */
  schoolYears: string[];
}

export const TRAIT_ALIASES = {
  network: ["rede", "network", "rede_ensino", "redeEnsino", "school_network", "schoolNetwork", "network_name", "networkName"],
  school: ["escola", "school", "school_name", "schoolName", "escola_nome", "escolaNome", "unidade"],
  class: ["turma", "class", "classroom", "class_name", "className", "turma_nome", "turmaNome", "classe"],
} as const;

export const MAX_GROUPS = 50;
export const MAX_VALUES_PER_FIELD = 100;
export const MAX_STUDENTS = 5000;

/** Comparação tolerante: sem acento, sem caixa, espaços colapsados ("7º A" = "7º  a"). */
export function normalizeValue(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function cleanList(input: unknown, max = MAX_VALUES_PER_FIELD): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    const v = String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
    const k = normalizeValue(v);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

export function normalizeGroups(input: unknown): AudienceGroup[] {
  if (!Array.isArray(input)) return [];
  const out: AudienceGroup[] = [];
  for (const g of input.slice(0, MAX_GROUPS)) {
    const o = (g && typeof g === "object" ? g : {}) as Record<string, unknown>;
    const group: AudienceGroup = {
      id: typeof o.id === "string" && /^[\w-]{1,40}$/.test(o.id) ? o.id : `g${out.length + 1}`,
      networks: cleanList(o.networks),
      schools: cleanList(o.schools),
      classes: cleanList(o.classes),
      schoolYears: normalizeSchoolYears(o.schoolYears),
    };
    if (!groupIsEmpty(group)) out.push(group);
  }
  return out;
}

/** Grupo sem nenhum critério não entra: ele casaria com TODO mundo por acidente. */
export function groupIsEmpty(g: AudienceGroup): boolean {
  return !g.networks.length && !g.schools.length && !g.classes.length && !g.schoolYears.length;
}

/**
 * Lista individual colada pelo cliente: IDs ou e-mails, um por linha, vírgula ou ponto e
 * vírgula. Guardada já normalizada (minúsculas, sem espaços) para a conferência ser direta.
 */
export function parseStudentList(input: unknown): string[] {
  const raw = Array.isArray(input) ? input.map(String).join("\n") : String(input ?? "");
  const seen = new Set<string>();
  for (const part of raw.split(/[\n,;\t]+/)) {
    const v = part.trim().toLowerCase().slice(0, 200);
    if (v) seen.add(v);
    if (seen.size >= MAX_STUDENTS) break;
  }
  return [...seen];
}

/** Valores de um trait, aceitando os apelidos e listas (professor com várias turmas). */
export function traitValues(traits: Record<string, unknown>, kind: keyof typeof TRAIT_ALIASES): string[] {
  const out: string[] = [];
  for (const alias of TRAIT_ALIASES[kind]) {
    const v = traits[alias];
    if (Array.isArray(v)) v.forEach((x) => out.push(normalizeValue(x)));
    else if (v !== undefined && v !== null && v !== "") out.push(normalizeValue(v));
  }
  return out.filter(Boolean);
}

function fieldMatches(wanted: string[], have: string[]): boolean {
  if (!wanted.length) return true;
  if (!have.length) return false;
  return wanted.some((w) => have.includes(normalizeValue(w)));
}

export function matchesGroup(group: AudienceGroup, traits: Record<string, unknown>): boolean {
  if (groupIsEmpty(group)) return false;
  if (!fieldMatches(group.networks, traitValues(traits, "network"))) return false;
  if (!fieldMatches(group.schools, traitValues(traits, "school"))) return false;
  if (!fieldMatches(group.classes, traitValues(traits, "class"))) return false;
  if (group.schoolYears.length && !matchesSchoolYears(group.schoolYears, traits)) return false;
  return true;
}

export function matchesAnyGroup(groups: AudienceGroup[], traits: Record<string, unknown>): boolean {
  return groups.some((g) => matchesGroup(g, traits));
}

/** Lista individual (servidor): o ID ou o e-mail do identify está na lista? */
export function matchesStudentList(list: string[], who: { id?: unknown; email?: unknown }): boolean {
  if (!list.length) return false;
  const keys = [who.id, who.email].map((v) => (typeof v === "string" || typeof v === "number" ? String(v).trim().toLowerCase() : "")).filter(Boolean);
  if (!keys.length) return false;
  const set = new Set(list);
  return keys.some((k) => set.has(k));
}

/** Resumo de um grupo para o painel: "Rede Estadual SP · EE Ana Rosa · 7º A". */
export function groupLabel(g: AudienceGroup, yearsLabel: (codes: string[]) => string): string {
  const parts = [g.networks.join(", "), g.schools.join(", "), g.classes.join(", "), g.schoolYears.length ? yearsLabel(g.schoolYears) : ""];
  return parts.filter(Boolean).join(" · ") || "Grupo vazio";
}
