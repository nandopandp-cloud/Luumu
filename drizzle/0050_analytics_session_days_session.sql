-- Perfil do Analytics: provas, tarefas e estudos de TODO o histórico do estudante, lidos do
-- resumo diário pelas sessões dele (sem ler o projeto inteiro). A tabela só recebe escrita do
-- cron, uma vez por dia. Rode este comando SOZINHO no SQL Editor (CONCURRENTLY não roda
-- junto com outros comandos numa transação).
CREATE INDEX CONCURRENTLY IF NOT EXISTS "analytics_session_days_session_idx" ON "analytics_session_days" ("project_id", "session_id");
