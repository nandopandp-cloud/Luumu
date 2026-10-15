-- Report Quinzenal: seção "Highlights" (entregas/acontecimentos e focos/próximos passos da quinzena).
-- Idempotente: pode rodar com ou sem a coluna já existindo.
ALTER TABLE IF EXISTS "product_report_periods" ADD COLUMN IF NOT EXISTS "highlights" jsonb DEFAULT '{}'::jsonb NOT NULL;
