-- Resumo diário das telas do Analytics (docs/infra/neon-custos.md, rodada 4). Duas tabelas novas;
-- nenhuma coluna existente muda, e o código no ar funciona com ou sem elas (sem as tabelas, o
-- painel lê as telas como antes).

-- 1) Uma linha por sessão e dia de Brasília, com as telas e os eventos do dia em listas paralelas.
CREATE TABLE IF NOT EXISTS "analytics_session_days" (
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "day" date NOT NULL,
  "session_id" text NOT NULL,
  "anon_id" text NOT NULL,
  "host" text NOT NULL,
  "device" text NOT NULL,
  "pages" integer NOT NULL,
  "duration_ms" bigint NOT NULL,
  "paths" text[] NOT NULL,
  "path_counts" integer[] NOT NULL,
  "path_ms" bigint[] NOT NULL,
  "events" text[] NOT NULL,
  "event_counts" integer[] NOT NULL
);
-- leitura do painel: um projeto num intervalo de dias
CREATE INDEX IF NOT EXISTS "analytics_session_days_project_idx" ON "analytics_session_days" ("project_id", "day");
-- o cron apaga e regrava um dia inteiro (todos os projetos); as linhas entram em ordem de dia
CREATE INDEX IF NOT EXISTS "analytics_session_days_day_brin" ON "analytics_session_days" USING brin ("day");

-- 2) Dias já resumidos. O painel só usa o resumo de dias marcados aqui.
CREATE TABLE IF NOT EXISTS "analytics_rollup_days" (
  "day" date PRIMARY KEY,
  "done_at" timestamptz NOT NULL DEFAULT now()
);

-- 3) Depois do deploy, preencha o histórico (dia a dia; pode interromper e rodar de novo):
--      pnpm exec tsx --tsconfig scripts/tsconfig.scripts.json scripts/backfill-analytics-rollups.ts
--    A partir daí o cron diário (/api/cron/reports) refaz os 3 últimos dias toda madrugada. Para
--    conferir que o resumo bate com as telas:
--      pnpm exec tsx --tsconfig scripts/tsconfig.scripts.json scripts/check-analytics-rollups.ts
