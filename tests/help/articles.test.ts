import { test } from "node:test";
import assert from "node:assert/strict";
import { HELP, HELP_EXAMPLES, searchHelp, totalArticles } from "../../lib/help/articles";

test("categorias e artigos com ids únicos e links internos", () => {
  assert.equal(HELP.length, 12);
  const ids = HELP.flatMap((c) => c.articles.map((a) => a.id));
  assert.equal(new Set(ids).size, ids.length, "id de artigo repetido (o link ?a= ficaria ambíguo)");
  assert.equal(totalArticles(), ids.length);
  for (const c of HELP) for (const a of c.articles) if (a.link) assert.match(a.link.href, /^\/[a-z]/, a.id);
});

test("busca ignora acento, caixa e palavras vazias", () => {
  assert.equal(searchHelp("como")[0], undefined); // só palavra vazia
  assert.equal(searchHelp("INTEGRACOES")[0].category.id, "integracoes");
  assert.equal(searchHelp("plano gratuito")[0].article.id, "plano-gratuito");
  assert.equal(searchHelp("trocar senha")[0].article.id, "senha");
});

test("os exemplos da página encontram o artigo certo", () => {
  const top = HELP_EXAMPLES.map((e) => searchHelp(e)[0]?.article.id);
  assert.deepEqual(top, ["primeira-pesquisa", "onde-ver", "instalar-sdk"]);
});

test("recursos que não existem não são vendidos como prontos", () => {
  const text = (id: string) => HELP.flatMap((c) => c.articles).find((a) => a.id === id)!.a;
  assert.match(text("replay"), /Ainda não/);
  assert.match(text("api"), /Ainda não/);
  assert.match(text("quais"), /em construção/);
});
