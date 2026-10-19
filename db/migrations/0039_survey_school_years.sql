-- Público por ano escolar: códigos "EF1".."EF9" / "EM1".."EM3" (ver lib/school-years.ts); [] = todos.
-- Idempotente. Rodar ANTES do deploy: /api/v1/config lê esta coluna.
ALTER TABLE IF EXISTS "surveys" ADD COLUMN IF NOT EXISTS "audience_school_years" jsonb DEFAULT '[]'::jsonb NOT NULL;
