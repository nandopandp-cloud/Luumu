-- Redução de custo do Neon, rodada 3 (ver docs/infra/neon-custos.md). Duas tabelas novas e um
-- índice; nenhuma coluna existente muda, e o código no ar funciona com ou sem elas.

-- 1) Peças dos avatares desenhados (lib/analytics/svg-parts.ts). Os personagens da Geniex repetem
--    os mesmos traçados em milhares de alunos; avatar_svgs guardava cada desenho inteiro (~27 KB,
--    2,1 GB no total). Agora avatar_svgs guarda a receita e cada traçado fica aqui uma vez.
CREATE TABLE IF NOT EXISTS "avatar_svg_parts" (
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "hash" text NOT NULL,
  "body" text NOT NULL,
  PRIMARY KEY ("project_id", "hash")
);

-- 2) Eventos rastreados por dia encerrado (lib/db/workspace.ts): o medidor do mês soma estas
--    linhas em vez de varrer o mês inteiro de analytics_pageviews a cada leitura.
CREATE TABLE IF NOT EXISTS "workspace_daily_events" (
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "day" date NOT NULL,
  "events" integer NOT NULL,
  PRIMARY KEY ("workspace_id", "day")
);

-- 3) Índice BRIN em analytics_pageviews.created_at. As telas são gravadas em ordem de tempo
--    (correlação física 0,998), mas para recortes de um dia o planner não usa o índice
--    (project_id, created_at): estima acesso aleatório pela 1ª coluna e prefere ler a tabela
--    inteira (1,7 GB). O BRIN guarda o menor e o maior horário de cada bloco de 32 páginas
--    (~200 KB no total), e um recorte por data passa a ler só as páginas daquele período. Atende
--    o total diário de eventos (item 2) e os recortes de período do painel de Analytics.
--    CONCURRENTLY não trava a coleta, mas não roda dentro de transação: execute sozinho.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "analytics_pv_created_brin"
  ON "analytics_pageviews" USING brin ("created_at") WITH (pages_per_range = 32, autosummarize = on);

--    Para conferir (deve aparecer "Bitmap Index Scan on analytics_pv_created_brin"):
--      EXPLAIN SELECT sum(cardinality(events)) FROM analytics_pageviews
--       WHERE created_at >= now() - interval '1 day';

-- 4) Depois do deploy, converta os desenhos já guardados e devolva o espaço:
--      pnpm exec tsx --tsconfig scripts/tsconfig.scripts.json scripts/compact-avatars.ts --apply
--    e então, de madrugada (trava avatar_svgs por alguns segundos: gravação de avatar novo espera):
--      VACUUM (FULL, ANALYZE) "avatar_svgs";
