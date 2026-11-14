/**
 * Cadastro de acessibilidade (luumu.com.br/cadastro-acessibilidade): o time operacional envia a
 * planilha-modelo (link do Google Planilhas ou arquivo) e recebe um link de CSV pronto para a
 * plataforma externa importar. A única transformação é na coluna "Perfis do convite": as
 * necessidades escritas por extenso (TDAH, Dislexia…) viram os ids dos perfis (foco, leitura…).
 *
 * Módulo PURO (rota, página e testes).
 */
import type { ProfileId } from "./features";

/** A planilha-modelo, nesta ordem. */
export const CADASTRO_COLUMNS = [
  "Id Rede",
  "Identificador Único Externo Escola",
  "Escola",
  "Ano Escolar",
  "Turma",
  "Identificador Único Externo Turma",
  "Identificador Único Externo",
  "Email",
  "Nome",
  "Papel",
  "Provider",
  "Perfis de acessibilidade",
  "Preferências de acessibilidade",
  "Convidar para acessibilidade",
  "Perfis do convite",
] as const;
const NEED_COLUMN = CADASTRO_COLUMNS.indexOf("Perfis do convite");

export const CADASTRO_MAX_ROWS = 20_000;
export const CADASTRO_TTL_DAYS = 7;

/** Necessidade escrita na planilha → perfil. Nomes do painel do estudante, sinônimos e os próprios ids. */
const NEED_WORDS: [ProfileId, string[]][] = [
  ["foco", ["transtorno do deficit de atencao", "deficit de atencao", "hiperatividade", "tdah", "foco"]],
  ["leitura", ["dislexia", "leitura"]],
  ["visao", ["baixa visao", "visao"]],
  ["ouvir", ["usuario cego leitor de tela", "usuario cego", "deficiencia visual", "deficiente visual", "leitor de tela", "cegueira", "cego", "cega", "ouvir"]],
  ["ritmo", ["habilidades motoras", "habilidade motora", "deficiencia fisica", "deficiencia motora", "ritmo"]],
  ["cores", ["daltonismo", "daltonico", "daltonica", "cores"]],
  ["calma", ["epilepsia", "calma"]],
  ["libras", ["deficiencia auditiva", "deficiente auditivo", "surdez", "surdo", "surda", "libras"]],
];

const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** "TDAH, Dislexia" → { ids: ["foco", "leitura"], unknown: [] }. Aceita ; , / | e " e ". */
export function needsToProfiles(raw: unknown): { ids: ProfileId[]; unknown: string[] } {
  const ids: ProfileId[] = [];
  const unknown: string[] = [];
  for (const part of String(raw ?? "").split(/[;,/|\n]| e /i).map((p) => p.trim()).filter(Boolean)) {
    let rest = ` ${norm(part)} `;
    let hit = false;
    for (const [id, words] of NEED_WORDS) {
      for (const w of words) {
        if (rest.includes(` ${w} `)) {
          rest = rest.replace(` ${w} `, " ");
          hit = true;
          if (!ids.includes(id)) ids.push(id);
        }
      }
    }
    if (!hit) unknown.push(part);
  }
  return { ids, unknown };
}

export type CadastroResult =
  | { ok: true; rows: string[][]; unknown: { line: number; value: string }[] }
  | { ok: false; error: string };

/** Tabela lida do arquivo → linhas no modelo, com "Perfis do convite" convertido. */
export function convertCadastro(table: unknown[][]): CadastroResult {
  const cells = table.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? "").trim()) : []));
  const hi = cells.findIndex((r) => r.filter(Boolean).length >= 2);
  if (hi < 0) return { ok: false, error: "A planilha está vazia." };
  const head = cells[hi].map(norm);
  const idx = CADASTRO_COLUMNS.map((c) => head.indexOf(norm(c)));
  const missing = CADASTRO_COLUMNS.filter((_, i) => idx[i] < 0);
  if (missing.length) return { ok: false, error: `Esta não é a planilha-modelo. Faltam as colunas: ${missing.join(", ")}.` };
  const data = cells.slice(hi + 1).map((r, n) => ({ r, line: hi + n + 2 })).filter(({ r }) => r.some(Boolean));
  if (!data.length) return { ok: false, error: "A planilha não tem estudantes." };
  if (data.length > CADASTRO_MAX_ROWS) return { ok: false, error: `A planilha tem mais de ${CADASTRO_MAX_ROWS.toLocaleString("pt-BR")} linhas. Divida em partes.` };
  const unknown: { line: number; value: string }[] = [];
  const rows = data.map(({ r, line }) =>
    CADASTRO_COLUMNS.map((_, i) => {
      const v = r[idx[i]] ?? "";
      if (i !== NEED_COLUMN) return v;
      const c = needsToProfiles(v);
      if (c.unknown.length) unknown.push({ line, value: c.unknown.join(", ") });
      return c.ids.join(";");
    })
  );
  return { ok: true, rows, unknown };
}

/* ---------------------------------------------------------------- CSV */

/** CSV → tabela. Aceita vírgula ou ponto e vírgula (Excel em português), aspas e BOM. */
export function parseCsv(text: string): string[][] {
  const s = text.replace(/^﻿/, "");
  const nl = s.search(/\r?\n/);
  const first = nl < 0 ? s : s.slice(0, nl);
  const sep = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"') {
        if (s[i + 1] === '"') { cell += '"'; i++; } else q = false;
      } else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/** Tabela → CSV no formato do Google Planilhas (vírgula, aspas só quando precisa, CRLF). */
export function toCsv(rows: readonly (readonly string[])[]): string {
  const cell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

/* ---------------------------------------------------------------- Google Planilhas */

/**
 * Link do Google Planilhas → link de exportação em CSV da mesma aba:
 *   …/d/<id>/edit?gid=123#gid=123  →  https://docs.google.com/spreadsheets/d/<id>/export?format=csv&gid=123
 * Só docs.google.com: o servidor busca este endereço, então nada além dele é aceito.
 */
export function googleSheetCsvUrl(link: unknown): string | null {
  if (typeof link !== "string" || link.length > 2000) return null;
  let u: URL;
  try {
    u = new URL(link.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.hostname !== "docs.google.com") return null;
  const m = /^\/spreadsheets\/d\/([\w-]{20,80})(?:\/|$)/.exec(u.pathname);
  if (!m) return null;
  const gid = /(?:^|[#&?])gid=(\d{1,12})/.exec(`${u.search}&${u.hash}`);
  return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv${gid ? `&gid=${gid[1]}` : ""}`;
}

/* ---------------------------------------------------------------- código do link */

/**
 * Código do link: validade (base 36) + "-" + 32 caracteres aleatórios. Mudar a validade muda o
 * nome do arquivo guardado, então não dá para estender um link.
 */
export function makeCadastroCode(now: number, random: string, ttlDays = CADASTRO_TTL_DAYS): string {
  const exp = Math.floor(now / 1000) + ttlDays * 86_400;
  return `${exp.toString(36)}-${random}`;
}
export function parseCadastroCode(code: unknown): { expiresAt: number } | null {
  if (typeof code !== "string") return null;
  const m = /^([0-9a-z]{5,8})-([A-Za-z0-9_-]{32})$/.exec(code);
  if (!m) return null;
  return { expiresAt: parseInt(m[1], 36) * 1000 };
}
