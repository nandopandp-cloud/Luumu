-- Report Quinzenal de Produto (módulo restrito, ver lib/product-report/).
-- Só tabelas novas: nenhuma tabela existente é alterada.

CREATE TABLE IF NOT EXISTS "product_report_settings" (
  "workspace_id" text PRIMARY KEY NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "platform_projects" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "weights" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "auto_sync" boolean DEFAULT false NOT NULL,
  "updated_by" text REFERENCES "users"("id") ON DELETE set null,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "product_report_periods" (
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "period" text NOT NULL,
  "goals" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "manual" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "intro" text DEFAULT '' NOT NULL,
  "notes" text DEFAULT '' NOT NULL,
  "updated_by" text REFERENCES "users"("id") ON DELETE set null,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("workspace_id", "period")
);

CREATE TABLE IF NOT EXISTS "product_report_runs" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "period" text NOT NULL,
  "kind" text NOT NULL,
  "status" text NOT NULL,
  "trigger" text DEFAULT 'manual' NOT NULL,
  "data" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "error" text,
  "created_by" text REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "product_report_runs_period_idx" ON "product_report_runs" ("workspace_id", "period", "created_at");
