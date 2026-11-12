/**
 * Plugin de Acessibilidade — estudantes convidados (lista individual).
 *
 * Módulo PURO: chave do estudante, leitura de lista colada ou CSV, e os estados do convite.
 * A lista mora no banco (accessibility_invitees) e nunca vai para o navegador; ver
 * audience.ts ("Privacidade").
 *
 * A chave é o ID do identify ou o e-mail (minúsculo). O SDK manda os dois e o servidor confere
 * qualquer um, então o cliente pode montar a lista com o que tiver à mão.
 */
import { isProfileId, PROFILES, type ProfileId } from "./features";
import { normalizeValue } from "./audience";

export const MAX_INVITEES_PER_IMPORT = 20_000;

export type InviteeStatus = "pending" | "shown" | "accepted" | "dismissed";
export const INVITEE_STATUS: Record<InviteeStatus, string> = {
  pending: "Ainda não viu",
  shown: "Viu o convite",
  accepted: "Aceitou",
  dismissed: "Dispensou",
};
export const isInviteeStatus = (v: unknown): v is InviteeStatus => typeof v === "string" && v in INVITEE_STATUS;

export interface InviteeInput {
  key: string;
  name: string;
  profile: ProfileId | null;
}

/** ID ou e-mail normalizado; "" quando não serve. */
export function inviteeKey(raw: unknown): string {
  if (typeof raw !== "string" && typeof raw !== "number") return "";
  const v = String(raw).trim().toLowerCase();
  if (!v || v.length > 200 || /[\s,;]/.test(v)) return "";
  return v;
}

/** Chave do estudante a partir do identify: ID primeiro, e-mail na falta dele. */
export function userKeyFrom(identity: { id?: unknown; email?: unknown }): string {
  return inviteeKey(identity.id) || inviteeKey(identity.email);
}

/** Perfil por id ("leitura") ou pelo nome mostrado ("Mais conforto na leitura"). */
export function parseProfile(raw: unknown): ProfileId | null {
  if (isProfileId(raw)) return raw;
  const n = normalizeValue(raw);
  if (!n) return null;
  return PROFILES.find((p) => p.id === n || normalizeValue(p.label) === n || normalizeValue(p.nudgeLabel) === n)?.id ?? null;
}

const HEADER = {
  key: ["id", "user_id", "userid", "usuario", "usuário", "email", "e-mail", "matricula", "matrícula", "ra"],
  name: ["nome", "name", "estudante", "aluno", "aluna"],
  profile: ["perfil", "profile", "perfil sugerido", "sugestao", "sugestão"],
};

function splitRow(line: string, sep: string): string[] {
  if (sep !== ",") return line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
  // CSV com aspas ("Souza, Ana")
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === "," && !quoted) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

export interface ParsedInvitees {
  rows: InviteeInput[];
  invalid: string[];
  duplicates: number;
}

/**
 * Lê o que o cliente colou ou subiu. Aceita:
 *  - uma coluna (um ID/e-mail por linha, ou separados por vírgula/ponto e vírgula);
 *  - tabela CSV/TSV/";" com cabeçalho (id|email|matrícula, nome, perfil) em qualquer ordem;
 *  - tabela sem cabeçalho: 1ª coluna = ID/e-mail, 2ª = nome, 3ª = perfil.
 */
export function parseInvitees(text: string): ParsedInvitees {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows: InviteeInput[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  if (!lines.length) return { rows, invalid, duplicates };

  const sep = lines[0].includes("\t") ? "\t" : lines[0].includes(";") && lines.some((l) => l.split(";").length > 2) ? ";" : ",";
  const first = splitRow(lines[0], sep).map((c) => normalizeValue(c));
  const findCol = (names: string[]) => first.findIndex((c) => names.includes(c));
  const hasHeader = findCol(HEADER.key) >= 0;
  // sem cabeçalho, é tabela quando a 2ª coluna não pode ser um ID (ex.: um nome com espaço);
  // "123, 456, ana@x.com" continua sendo uma lista de três estudantes
  const tabular =
    hasHeader ||
    lines.some((l) => {
      const cells = splitRow(l, sep);
      return cells.length > 1 && !!cells[1] && !inviteeKey(cells[1]);
    });
  const cols = hasHeader
    ? { key: findCol(HEADER.key), name: findCol(HEADER.name), profile: findCol(HEADER.profile) }
    : { key: 0, name: 1, profile: 2 };

  const push = (keyRaw: string, name = "", profile: unknown = null) => {
    const key = inviteeKey(keyRaw);
    if (!key) {
      if (keyRaw.trim()) invalid.push(keyRaw.trim().slice(0, 80));
      return;
    }
    if (seen.has(key)) {
      duplicates++;
      return;
    }
    seen.add(key);
    if (rows.length < MAX_INVITEES_PER_IMPORT) rows.push({ key, name: name.replace(/\s+/g, " ").trim().slice(0, 120), profile: parseProfile(profile) });
  };

  for (const [i, line] of lines.entries()) {
    if (hasHeader && i === 0) continue;
    if (!tabular && !hasHeader) {
      // lista simples: "123, 456; ana@x.com"
      for (const part of line.split(/[,;\t]+/)) push(part);
      continue;
    }
    const cells = splitRow(line, sep);
    push(cells[cols.key] ?? "", cols.name >= 0 ? cells[cols.name] ?? "" : "", cols.profile >= 0 ? cells[cols.profile] : null);
  }
  return { rows, invalid, duplicates };
}
