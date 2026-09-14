-- Último acesso do usuário, exibido na tela de membros do workspace.
-- Null = nenhum acesso registrado desde que a coluna passou a existir.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_seen_at" timestamp with time zone;
