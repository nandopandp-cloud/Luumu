-- Resultados prontos dos blocos do painel de Analytics (lib/db/analytics-panel.ts). Uma tabela
-- nova; o código no ar funciona com ou sem ela (sem a tabela, o painel calcula na hora como antes).
--
-- O painel lê daqui o último resultado de cada bloco (um select por página) e, se ele passou do
-- prazo (Hoje 10 min, 7 dias 30 min, períodos maiores 1 h), mostra o que tem e recalcula depois
-- da resposta. O cron /api/cron/analytics recalcula de madrugada o que foi aberto nos últimos 7
-- dias e apaga o que ninguém abre há 14.
CREATE TABLE IF NOT EXISTS "analytics_results" (
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "key" text NOT NULL,
  "value" jsonb NOT NULL,
  "computed_at" timestamptz NOT NULL,
  "accessed_at" timestamptz NOT NULL DEFAULT now(),
  "refreshing_at" timestamptz,
  PRIMARY KEY ("project_id", "key")
);
