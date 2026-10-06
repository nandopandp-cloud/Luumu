-- Cota e amostragem de heatmaps sem ler a tabela inteira.
--
-- heatmapQuota (sessões distintas do mês por workspace) e heatmapPlan (estimativa das últimas
-- 24h por projeto) rodam a cada cache miss de instância. Sem índice que as cobrisse, cada
-- execução era seq scan + sort de heatmap_pageviews inteira (a tabela mais pesada do banco,
-- linhas largas por causa dos jsonb de cliques/movimento): em produção foram ~8 mil scans
-- lendo ~1 bilhão de linhas, crescendo junto com a tabela até a retenção.
--
-- Com session_id (e sample_rate) na chave, as duas contagens viram index-only scan: lêem só
-- o índice, uma fração do heap. O novo índice por workspace substitui heatmap_pv_ws_idx
-- (mesmas colunas iniciais), que continua servindo à limpeza diária em lib/db/retention.ts.
--
-- CONCURRENTLY não trava a ingestão, mas não roda dentro de transação: execute cada comando
-- separado (ex.: SQL Editor do Neon, um por vez).

CREATE INDEX CONCURRENTLY IF NOT EXISTS "heatmap_pv_ws_session_idx"
  ON "heatmap_pageviews" ("workspace_id", "created_at", "session_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "heatmap_pv_project_session_idx"
  ON "heatmap_pageviews" ("project_id", "created_at", "session_id", "sample_rate");

DROP INDEX CONCURRENTLY IF EXISTS "heatmap_pv_ws_idx";

-- Index-only scan depende do visibility map: um VACUUM agora deixa os índices novos úteis já,
-- sem esperar o autovacuum.
VACUUM (ANALYZE) "heatmap_pageviews";

-- events: ~7,7 mil linhas ocupando 32 MB de heap + 26 MB de índice (inchaço dos UPDATEs de
-- contagem antigos). O catálogo de eventos do /config lê a tabela por projeto, então cada
-- leitura percorre todo esse espaço morto. VACUUM FULL reescreve a tabela compacta; trava
-- `events` por menos de 1 s nesse tamanho.
VACUUM (FULL, ANALYZE) "events";
