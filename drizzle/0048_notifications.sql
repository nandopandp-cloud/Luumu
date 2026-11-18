-- Notificações no produto do cliente (lib/db/notifications.ts): sino no header + recados.
-- Tabelas novas; sem elas o painel funciona normalmente e só o módulo Notificações fica indisponível.
CREATE TABLE IF NOT EXISTS "notification_settings" (
  "project_id" text PRIMARY KEY REFERENCES "projects"("id") ON DELETE cascade,
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "settings" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "updated_by" text REFERENCES "users"("id") ON DELETE set null,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" text PRIMARY KEY,
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "kind" text NOT NULL DEFAULT 'recado',
  "category" text NOT NULL DEFAULT 'aviso',
  "title" text NOT NULL,
  "body" text NOT NULL DEFAULT '',
  "cta_label" text,
  "cta_url" text,
  "audience" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "hosts" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "pinned" boolean NOT NULL DEFAULT false,
  "status" text NOT NULL DEFAULT 'rascunho',
  "publish_at" timestamptz,
  "expires_at" timestamptz,
  "published_at" timestamptz,
  "created_by" text REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "notifications_project_idx" ON "notifications" ("project_id", "status");

CREATE TABLE IF NOT EXISTS "notification_events" (
  "notification_id" text NOT NULL REFERENCES "notifications"("id") ON DELETE cascade,
  "user_key" text NOT NULL,
  "kind" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("notification_id", "kind", "user_key")
);
