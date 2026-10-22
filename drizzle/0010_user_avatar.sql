-- Foto de perfil do usuário (null = usa a inicial do nome, comportamento anterior).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" text;
