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
