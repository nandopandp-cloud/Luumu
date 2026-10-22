-- Exibições do widget de pesquisa (indicador "visualizaram e não responderam").
-- Só tabela nova: nenhuma tabela existente é alterada.

CREATE TABLE IF NOT EXISTS "survey_views" (
  "id" text PRIMARY KEY NOT NULL,
  "survey_id" text NOT NULL REFERENCES "surveys"("id") ON DELETE cascade,
  "host" text,
  "device" text,
  "respondent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "responded_at" timestamp with time zone
);
CREATE INDEX IF NOT EXISTS "survey_views_survey_created_idx" ON "survey_views" ("survey_id", "created_at");
