/*
  Cadastro de acessibilidade (lib/accessibility/cadastro.ts): planilha-modelo → CSV com
  "Perfis do convite" em ids de perfil; link do Google Planilhas; código do link com validade.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CADASTRO_COLUMNS, convertCadastro, googleSheetCsvUrl, makeCadastroCode, needsToProfiles, parseCadastroCode, parseCsv, toCsv,
} from "@/lib/accessibility/cadastro";

test("necessidade escrita → perfil (tabela combinada com o time)", () => {
  const table: [string, string][] = [
    ["TDAH", "foco"], ["Dislexia", "leitura"], ["Baixa visão", "visao"], ["Habilidades motoras", "ritmo"],
    ["Epilepsia", "calma"], ["Deficiência auditiva", "libras"], ["Usuário cego (leitor de tela)", "ouvir"], ["Daltonismo", "cores"],
  ];
  for (const [need, id] of table) assert.deepEqual(needsToProfiles(need).ids, [id], need);
  assert.deepEqual(needsToProfiles("TDAH, Dislexia, Baixa visão").ids, ["foco", "leitura", "visao"]);
  assert.deepEqual(needsToProfiles("TDAH;Dislexia").ids, ["foco", "leitura"]);
  assert.deepEqual(needsToProfiles("cores;ritmo;leitura;").ids, ["cores", "ritmo", "leitura"], "ids continuam valendo");
  assert.deepEqual(needsToProfiles("tdah e dislexia").ids, ["foco", "leitura"]);
  assert.deepEqual(needsToProfiles("Baixa visão").ids, ["visao"], "não vira 'ouvir'");
  assert.deepEqual(needsToProfiles("TEA"), { ids: [], unknown: ["TEA"] });
  assert.deepEqual(needsToProfiles(""), { ids: [], unknown: [] });
});

const HEAD = [...CADASTRO_COLUMNS];
const row = (needs: string) => ["rede", "esc", "Escola", "1", "1A", "t-1a", "a@x.com", "a@x.com", "Aluno", "STUDENT", "prov", "", "", "sim", needs];

test("converte a planilha-modelo: só 'Perfis do convite' muda; colunas em qualquer ordem", () => {
  const shuffled = [...HEAD].reverse();
  const r = convertCadastro([shuffled, [...row("TDAH, Dislexia")].reverse(), [...row("TEA")].reverse(), ["", ""]]);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.rows.length, 2, "linha vazia ignorada");
  assert.deepEqual(r.rows[0], row("foco;leitura"), "sai na ordem do modelo");
  assert.equal(r.rows[1][14], "");
  assert.deepEqual(r.unknown, [{ line: 3, value: "TEA" }]);
});

test("planilha fora do modelo é recusada dizendo o que falta", () => {
  const r = convertCadastro([["Nome", "Email", "Necessidade"], ["X", "x@y.com", "TDAH"]]);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.error, /Faltam as colunas: Id Rede, Identificador Único Externo Escola/);
  assert.equal(convertCadastro([HEAD]).ok, false, "sem estudantes");
});

test("CSV: vírgula ou ponto e vírgula, aspas, BOM; saída no formato do Google", () => {
  assert.deepEqual(parseCsv('﻿a,b\r\n"x, y","com ""aspas"""\n'), [["a", "b"], ["x, y", 'com "aspas"']]);
  assert.deepEqual(parseCsv("a;b;c\n1;2;foco"), [["a", "b", "c"], ["1", "2", "foco"]], "Excel em português");
  assert.equal(toCsv([["a", "foco;leitura", "x, y"]]), 'a,foco;leitura,"x, y"', "';' sem aspas, como no export do Google");
  const back = parseCsv(toCsv([HEAD, row("foco;leitura")]));
  assert.deepEqual(back[1], row("foco;leitura"));
});

test("link do Google Planilhas → export em CSV da mesma aba; outros endereços recusados", () => {
  const id = "1YVxLSvcGamwjCEqqKIAE2zCJo4IOjBuDG1JEv4EFpW0";
  assert.equal(googleSheetCsvUrl(`https://docs.google.com/spreadsheets/d/${id}/edit?gid=495841841#gid=495841841`), `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=495841841`);
  assert.equal(googleSheetCsvUrl(`https://docs.google.com/spreadsheets/d/${id}/edit?usp=sharing`), `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`);
  assert.equal(googleSheetCsvUrl(`https://docs.google.com/spreadsheets/d/${id}/edit#gid=12`), `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=12`);
  for (const bad of [`http://docs.google.com/spreadsheets/d/${id}/edit`, `https://evil.com/spreadsheets/d/${id}`, `https://docs.google.com.evil.com/spreadsheets/d/${id}`, "https://docs.google.com/document/d/abc", "nada", 42])
    assert.equal(googleSheetCsvUrl(bad), null, String(bad));
});

test("código do link: 7 dias de validade, formato fechado", () => {
  const now = Date.UTC(2026, 10, 13);
  const code = makeCadastroCode(now, "a".repeat(32));
  assert.equal(parseCadastroCode(code)!.expiresAt, now + 7 * 86_400_000);
  assert.equal(parseCadastroCode("../x"), null);
  assert.equal(parseCadastroCode(code + "x"), null);
  assert.equal(parseCadastroCode(`${code.split("-")[0]}-curto`), null);
});
