-- Base da Aderência no Analytics, por projeto: 'daily' = DAU médio ÷ MAU (como era) ou
-- 'weekly' = WAU médio ÷ MAU, para produtos de uso semanal (ex.: Educadores).
-- Sem a coluna, o código no ar continua com DAU/MAU (getAnalyticsSettings cai no padrão).
ALTER TABLE "analytics_settings" ADD COLUMN IF NOT EXISTS "adherence_base" text NOT NULL DEFAULT 'daily';
