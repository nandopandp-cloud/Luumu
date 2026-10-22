-- Respostas desconsideradas (spam, testes): continuam guardadas, mas saem de todos os cálculos.
-- Idempotente: pode rodar com ou sem as colunas já existindo.
ALTER TABLE IF EXISTS "responses" ADD COLUMN IF NOT EXISTS "excluded_at" timestamp with time zone;
ALTER TABLE IF EXISTS "responses" ADD COLUMN IF NOT EXISTS "excluded_by" text REFERENCES "users"("id") ON DELETE set null;
