import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanQuery, fold, highlight, likePattern, matchCommands, relativeTime, score, snippet, SQL_ACCENTS_FROM, SQL_ACCENTS_TO } from "../../lib/search/core";

test("ignora acento e caixa", () => {
  assert.equal(fold("Satisfação NÚMERO"), "satisfacao numero");
  assert.equal(SQL_ACCENTS_FROM.length, SQL_ACCENTS_TO.length);
  for (const [i, ch] of [...SQL_ACCENTS_FROM].entries()) assert.equal(fold(ch), SQL_ACCENTS_TO[i], ch);
});

test("termo do usuário nunca vira curinga no LIKE", () => {
  assert.equal(likePattern("100%_ok"), "%100\\%\\_ok%");
  assert.equal(likePattern("Ação"), "%acao%");
  assert.equal(cleanQuery("  muito   lento \n"), "muito lento");
  assert.equal(cleanQuery("x".repeat(200)).length, 80);
});

test("destaca as ocorrências sem acento", () => {
  assert.deepEqual(highlight("Pesquisa de Satisfação", "satisfacao"), [
    { text: "Pesquisa de ", match: false },
    { text: "Satisfação", match: true },
  ]);
  assert.equal(highlight("a b a", "a").filter((s) => s.match).length, 2);
  assert.deepEqual(highlight("nada", ""), [{ text: "nada", match: false }]);
});

test("recorte do comentário centra no termo", () => {
  const long = `${"palavra ".repeat(30)}o app está muito lento no celular ${"fim ".repeat(30)}`;
  const s = snippet(long, "lento", 20);
  assert.match(s, /^….*lento.*…$/);
  assert.ok(s.length < 60);
  assert.equal(snippet("curto", "x"), "curto");
});

test("páginas e ações: começo do título e palavras-chave", () => {
  assert.equal(matchCommands("plano")[0].id, "p-billing");
  assert.equal(matchCommands("convi")[0].id, "a-invite");
  assert.ok(matchCommands("tema escuro").some((c) => c.id === "a-theme"));
  assert.equal(matchCommands("zzzz").length, 0);
  assert.ok(score("res", "Respostas") > score("res", "Nova resposta"));
});

test("tempo relativo em português", () => {
  const now = Date.parse("2026-10-03T12:00:00Z");
  assert.equal(relativeTime("2026-10-03T11:59:30Z", now), "agora");
  assert.equal(relativeTime("2026-10-03T11:55:00Z", now), "há 5 minutos");
  assert.equal(relativeTime("2026-10-02T12:00:00Z", now), "ontem");
});
