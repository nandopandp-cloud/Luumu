import "server-only";
import type { ExportRow } from "@/lib/db/responses";

const HEADERS = ["ID", "Pesquisa", "Respondente", "Canal", "Sentimento", "Nota", "Comentário", "Data"];

function cell(v: string | number | null): string {
  const s = v == null ? "" : String(v);
  // escapa aspas e envolve se contiver separador, aspas ou quebra de linha
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Gera um CSV (UTF-8 com BOM p/ Excel) das respostas. */
export function toCsv(rows: ExportRow[]): Buffer {
  const lines = [HEADERS.join(",")];
  for (const r of rows) {
    lines.push(
      [
        cell(r.id),
        cell(r.surveyName),
        cell(r.respondent),
        cell(r.channel),
        cell(r.sentiment),
        cell(r.score),
        cell(r.comment),
        cell(r.createdAt.toISOString()),
      ].join(",")
    );
  }
  // BOM para o Excel reconhecer UTF-8 (acentos)
  return Buffer.from("﻿" + lines.join("\r\n"), "utf8");
}

/** Várias tabelas num CSV só: título de cada uma numa linha, uma linha em branco entre elas. */
export function tablesToCsv(tables: { title: string; columns: string[]; rows: (string | number | null)[][] }[]): Buffer {
  const out: string[] = [];
  tables.forEach((t, i) => {
    if (i) out.push("");
    out.push(cell(t.title));
    out.push(t.columns.map(cell).join(","));
    for (const r of t.rows) out.push(t.columns.map((_, j) => cell(r[j] ?? null)).join(","));
  });
  return Buffer.from("﻿" + out.join("\r\n"), "utf8");
}
