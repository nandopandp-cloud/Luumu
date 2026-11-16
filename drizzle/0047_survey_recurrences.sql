-- Pesquisas recorrentes (lib/db/survey-recurrences.ts): opção "Repetir" do diálogo de duplicar.
-- Tabela nova; sem ela o painel funciona normalmente e só a recorrência fica indisponível.
CREATE TABLE IF NOT EXISTS "survey_recurrences" (
  "id" text PRIMARY KEY,
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "interval_weeks" integer NOT NULL,
  "duration_days" integer NOT NULL,
  "last_survey_id" text REFERENCES "surveys"("id") ON DELETE set null,
  "last_starts_at" text NOT NULL,
  "survey_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "active" boolean NOT NULL DEFAULT true,
  "created_by" text REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "survey_recurrences_project_idx" ON "survey_recurrences" ("project_id");
