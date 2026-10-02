-- Dispositivo em que a pesquisa foi vista e respondida: mobile | tablet | desktop.
-- Null = resposta anterior a esta coluna (o dado não existia antes).
ALTER TABLE "responses" ADD COLUMN IF NOT EXISTS "device" text;
