-- Report Quinzenal: mensagem de abertura do report ("Fala pessoal, boa tarde…").
-- A coluna também entrou na 0032 depois que ela já tinha sido publicada; quem aplicou a 0032
-- antes disso ficou sem ela, e o CREATE TABLE IF NOT EXISTS não a cria ao reaplicar.
-- Idempotente: pode rodar com ou sem a coluna já existindo.
ALTER TABLE IF EXISTS "product_report_periods" ADD COLUMN IF NOT EXISTS "intro" text DEFAULT '' NOT NULL;
