/*
  Perfil do usuário do Analytics (components/analytics/UsersView.tsx): provas, tarefas e estudos
  aparecem em linguagem de produto, no quadro e no cabeçalho de cada sessão.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// o componente importa as server actions (que leem estas variáveis ao carregar); aqui nunca são chamadas
process.env.AUTH_SECRET ||= "test-secret";
process.env.DATABASE_URL ||= "postgres://u:p@localhost/test";

const page = (path: string, at: string, events: string[] = []) => ({ path, at, ms: 60_000, events });
const session = (id: string, startedAt: string, pages: ReturnType<typeof page>[]) => ({
  id, startedAt, lastSeenAt: startedAt, device: "desktop", os: "Windows", browser: "Chrome", channel: "direct" as const,
  referrer: "", campaign: "", host: "preparasp.jovensgenios.com", pageviews: pages.length, ms: 600_000, pages,
});

test("o perfil mostra o que a estudante abriu, iniciou e concluiu", async () => {
  const { Profile } = await import("@/components/analytics/UsersView");
  const p = {
    key: "u:1", anonId: "42uzh7qhmwnh6ab2", browsers: 2, userId: "1", email: "alice@escola.com", name: "Alice", avatar: null,
    firstSeenAt: "2026-11-16T10:00:00Z", lastSeenAt: "2026-11-19T11:02:00Z", channel: "direct" as const, source: "", campaign: "", landing: "entrar",
    totals: { sessions: 2, pageviews: 6, ms: 1_200_000, days: 2 }, activity: [], topEvents: [], topPages: [], responses: [],
    sessions: [
      session("s2", "2026-11-19T11:00:00Z", [page("home", "2026-11-19T11:00:00Z"), page("instituicao/assignments/:id/topic/:id/quiz", "2026-11-19T11:02:00Z")]),
      session("s1", "2026-11-16T10:00:00Z", [
        page("instituicao/avaliacoes/:id/onboarding", "2026-11-16T10:00:00Z"),
        page("instituicao/avaliacoes/:id/quiz", "2026-11-16T10:01:00Z", ["click_finalizar"]),
        page("instituicao/avaliacoes/:id/results", "2026-11-16T10:40:00Z"),
      ]),
    ],
  };
  const html = renderToStaticMarkup(createElement(Profile, { p }));
  assert.match(html, /Provas, tarefas e estudos/);
  assert.match(html, /Prova Genial/);
  assert.match(html, /Concluiu a Prova Genial/, "chip no cabeçalho da sessão");
  assert.match(html, /Iniciou a Tarefa/);
  assert.match(html, /Iniciou e não chegou ao resultado em 1 sessão/);
  assert.match(html, /Navegadores/);
});
