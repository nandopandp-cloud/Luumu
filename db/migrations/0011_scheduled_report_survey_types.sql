-- Tipos de pesquisa acompanhados por um envio agendado (ex.: ["CSAT","SUS"]).
-- Quando preenchido, o cron resolve a cada ciclo a última campanha encerrada de cada tipo,
-- em vez de ficar preso aos survey_ids escolhidos na criação do agendamento.
-- [] mantém o comportamento anterior.
ALTER TABLE "scheduled_reports" ADD COLUMN IF NOT EXISTS "survey_types" jsonb DEFAULT '[]'::jsonb NOT NULL;
