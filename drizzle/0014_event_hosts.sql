-- Catálogo de eventos por plataforma (hostname): de qual produto do cliente cada evento veio.
-- Tabela nova, sem alterar dados existentes; os eventos anteriores seguem em "events" sem plataforma.
CREATE TABLE IF NOT EXISTS "event_hosts" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "host" text NOT NULL,
  "name" text NOT NULL,
  "first_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "event_hosts_project_host_name_uidx" ON "event_hosts" ("project_id", "host", "name");
CREATE INDEX IF NOT EXISTS "event_hosts_project_idx" ON "event_hosts" ("project_id");
