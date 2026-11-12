-- Verificação de identidade do plugin de acessibilidade (lib/accessibility/verify.ts).
--
-- Para bancos onde `accessibility_settings` foi criada pela primeira versão da 0044, sem estas
-- colunas: o CREATE TABLE IF NOT EXISTS da 0044 atual pula a tabela existente e não as
-- acrescenta. Idempotente: pode rodar em qualquer banco, com ou sem as colunas.
ALTER TABLE "accessibility_settings" ADD COLUMN IF NOT EXISTS "identity_secret" text;
ALTER TABLE "accessibility_settings" ADD COLUMN IF NOT EXISTS "require_verified" boolean NOT NULL DEFAULT false;
