-- Busca de usuários do Analytics pelo ID do produto e pelo e-mail (nome e foto nas respostas,
-- busca e exportações — lib/db/people.ts). Tabela pequena (~15 mil linhas): criação rápida.
CREATE INDEX IF NOT EXISTS "analytics_users_user_id_idx" ON "analytics_users" ("project_id", "user_id") WHERE "user_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "analytics_users_email_idx" ON "analytics_users" ("project_id", lower("user_email")) WHERE "user_email" IS NOT NULL;
