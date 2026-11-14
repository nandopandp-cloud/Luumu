import "server-only";
import { randomBytes } from "node:crypto";
import ExcelJS from "exceljs";
import { del, get, list, put } from "@vercel/blob";
import { makeCadastroCode, parseCadastroCode } from "./cadastro";

/*
  Guarda do CSV gerado pelo cadastro de acessibilidade (lib/accessibility/cadastro.ts), no Vercel
  Blob, por 7 dias. O arquivo é privado (só esta rota lê); se o Blob da conta não aceitar arquivos
  privados, vai como público num caminho de 32 caracteres aleatórios que nunca é mostrado — quem
  baixa sempre passa por /cadastro-acessibilidade/<código>/export, que confere a validade.
  Arquivos vencidos são apagados a cada novo envio.
*/
const PREFIX = "cadastro-acessibilidade/";
const pathFor = (code: string) => `${PREFIX}${code}.csv`;

export function cadastroStorageReady(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

export async function saveCadastroCsv(csv: string): Promise<string> {
  const code = makeCadastroCode(Date.now(), randomBytes(24).toString("base64url"));
  const body = "﻿" + csv; // BOM: Excel abre os acentos certo
  const opts = { contentType: "text/csv; charset=utf-8", addRandomSuffix: false, cacheControlMaxAge: 60 } as const;
  try {
    await put(pathFor(code), body, { ...opts, access: "private" });
  } catch {
    await put(pathFor(code), body, { ...opts, access: "public" });
  }
  void cleanupExpired();
  return code;
}

/** CSV do código; "expired" se venceu; null se não existe. */
export async function readCadastroCsv(code: string): Promise<string | "expired" | null> {
  const parsed = parseCadastroCode(code);
  if (!parsed) return null;
  if (parsed.expiresAt < Date.now()) {
    void del(pathFor(code)).catch(() => {});
    return "expired";
  }
  // acha o arquivo pela listagem (mesma credencial do put; não depende de BLOB_STORE_ID)
  let url: string | undefined;
  try {
    const { blobs } = await list({ prefix: pathFor(code), limit: 1 });
    url = blobs.find((b) => b.pathname === pathFor(code))?.url;
  } catch {
    return null;
  }
  if (!url) return null;
  for (const access of ["private", "public"] as const) {
    try {
      const r = await get(url, { access });
      if (r && r.statusCode === 200 && r.stream) return await new Response(r.stream).text();
    } catch {
      // tenta o outro tipo de acesso
    }
  }
  return null;
}

async function cleanupExpired() {
  try {
    const { blobs } = await list({ prefix: PREFIX, limit: 1000 });
    const old = blobs.filter((b) => {
      const p = parseCadastroCode(b.pathname.slice(PREFIX.length).replace(/\.csv$/, ""));
      return !p || p.expiresAt < Date.now();
    });
    if (old.length) await del(old.map((b) => b.url));
  } catch {
    // limpeza é melhor esforço: a validade é conferida na leitura de qualquer jeito
  }
}

/** Primeira aba de um .xlsx → tabela de textos (data e fórmula viram o valor exibido). */
export async function readXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const rows: string[][] = [];
  ws.eachRow({ includeEmpty: true }, (row, n) => {
    const out: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, c) => {
      out[c - 1] = (cell.text ?? "").toString();
    });
    rows[n - 1] = Array.from(out, (v) => v ?? "");
  });
  return Array.from(rows, (r) => r ?? []);
}
