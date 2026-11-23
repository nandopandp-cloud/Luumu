-- Perfil do Analytics agrupado pela PESSOA (ID do produto), não pelo navegador: as sessões de
-- um estudante em vários computadores (casa, laboratório da escola) entram no mesmo perfil.
-- Tabela grande: CONCURRENTLY não trava a coleta. Rode este comando SOZINHO no SQL Editor
-- (CONCURRENTLY não roda junto com outros comandos numa transação).
CREATE INDEX CONCURRENTLY IF NOT EXISTS "analytics_sessions_user_idx" ON "analytics_sessions" ("project_id", "user_id") WHERE "user_id" IS NOT NULL;
