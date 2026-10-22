-- Pedidos de mudança de plano (área Plano & Cobrança). Só cria a tabela.
CREATE TABLE IF NOT EXISTS "plan_requests" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "user_id" text REFERENCES "users"("id") ON DELETE set null,
  "plan" text NOT NULL,
  "cycle" text DEFAULT 'monthly' NOT NULL,
  "from_plan" text NOT NULL,
  "message" text DEFAULT '' NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "plan_requests_ws_idx" ON "plan_requests" ("workspace_id");
