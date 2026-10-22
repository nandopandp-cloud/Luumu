-- E-mail e nome dos usuários identificados (Luumu.identify) na aba Usuários do Analytics.
-- A 0020 já cria as colunas em bancos novos; em bancos onde a 0020 rodou antes delas existirem,
-- o CREATE TABLE IF NOT EXISTS não altera a tabela, então elas entram aqui.
ALTER TABLE "analytics_users" ADD COLUMN IF NOT EXISTS "user_email" text;
ALTER TABLE "analytics_users" ADD COLUMN IF NOT EXISTS "user_name" text;
ALTER TABLE "heatmap_pageviews" ADD COLUMN IF NOT EXISTS "sample_rate" real DEFAULT 1 NOT NULL;
