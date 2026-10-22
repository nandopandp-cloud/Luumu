-- Redução de custo do Neon: índice que faltava numa consulta cara, índices redundantes e uma
-- tabela abandonada. Nada aqui altera dado de produto. Ver docs/neon-custos.md.
--
-- CONCURRENTLY não trava a ingestão do SDK, mas não roda dentro de transação: execute cada
-- comando separado (ex.: SQL Editor do Neon, um por vez).

-- 1) Nome "pessoal" do usuário (lib/db/analytics.ts → personal()): para cada linha da lista de
--    usuários, do perfil e do status da captura de identidade, o Postgres procura OUTRA pessoa
--    do projeto com o mesmo nome. Sem índice em user_name, cada procura percorria todos os
--    usuários do projeto (custo quadrático na lista). Parcial: só quem tem nome entra.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "analytics_users_name_idx"
  ON "analytics_users" ("project_id", "user_name") WHERE "user_name" IS NOT NULL;

-- 2) Índices de created_at criados na migração 0029 para a limpeza antiga de 90 dias
--    (lib/db/heatmap-retention.ts, que nunca foi chamada e foi removida). A retenção diária
--    (lib/db/retention.ts) filtra por workspace e usa heatmap_pv_ws_session_idx. Em
--    heatmap_pageviews — a tabela mais escrita e mais larga do banco — cada índice a mais é
--    escrita, WAL e armazenamento em toda visita gravada.
DROP INDEX CONCURRENTLY IF EXISTS "heatmap_pageviews_created_at";
DROP INDEX CONCURRENTLY IF EXISTS "heatmap_snapshots_created_at";

-- 3) Índices cobertos por outro índice com as mesmas colunas iniciais (o único já atende a
--    qualquer busca que eles atenderiam): só custavam escrita e espaço.
DROP INDEX CONCURRENTLY IF EXISTS "events_project_idx";          -- coberto por events_project_name_uidx
DROP INDEX CONCURRENTLY IF EXISTS "event_hosts_project_idx";     -- coberto por event_hosts_project_host_name_uidx
DROP INDEX CONCURRENTLY IF EXISTS "product_elements_project_idx"; -- coberto por product_elements_uidx
DROP INDEX CONCURRENTLY IF EXISTS "api_keys_pk_idx";             -- duplica a UNIQUE de public_key

-- 4) rate_limits: em desuso desde que o rate limit passou a ser contado em memória
--    (lib/api/ratelimit.ts). Nenhum código lê ou grava nela; as linhas antigas só ocupavam espaço.
DROP TABLE IF EXISTS "rate_limits";
