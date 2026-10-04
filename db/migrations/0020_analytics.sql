-- Analytics de produto: configuração por projeto, usuários, sessões, telas e visões salvas.
-- A coleta começa DESLIGADA em todo projeto (alguém precisa ativar no painel).
CREATE TABLE IF NOT EXISTS "analytics_settings" (
  "project_id" text PRIMARY KEY NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "enabled" boolean DEFAULT false NOT NULL,
  "north_star_event" text,
  "activation_event" text,
  "task_start_event" text,
  "task_done_event" text,
  "updated_by" text REFERENCES "users"("id") ON DELETE set null,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "analytics_users" (
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "anon_id" text NOT NULL,
  "user_id" text,
  "user_email" text,
  "user_name" text,
  "first_seen_at" timestamp with time zone NOT NULL,
  "last_seen_at" timestamp with time zone NOT NULL,
  "first_channel" text DEFAULT 'direct' NOT NULL,
  "first_source" text DEFAULT '' NOT NULL,
  "first_campaign" text DEFAULT '' NOT NULL,
  "first_landing" text DEFAULT '' NOT NULL,
  "first_host" text DEFAULT '' NOT NULL,
  "first_device" text DEFAULT 'desktop' NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "analytics_users_pk" ON "analytics_users" ("project_id", "anon_id");
CREATE INDEX IF NOT EXISTS "analytics_users_first_idx" ON "analytics_users" ("project_id", "first_seen_at");

CREATE TABLE IF NOT EXISTS "analytics_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "anon_id" text NOT NULL,
  "user_id" text,
  "host" text DEFAULT '' NOT NULL,
  "device" text DEFAULT 'desktop' NOT NULL,
  "os" text DEFAULT 'Outro' NOT NULL,
  "browser" text DEFAULT 'Outro' NOT NULL,
  "viewport_w" integer DEFAULT 0 NOT NULL,
  "started_at" timestamp with time zone NOT NULL,
  "last_seen_at" timestamp with time zone NOT NULL,
  "pageviews" integer DEFAULT 0 NOT NULL,
  "duration_ms" integer DEFAULT 0 NOT NULL,
  "landing_path" text DEFAULT '' NOT NULL,
  "exit_path" text DEFAULT '' NOT NULL,
  "channel" text DEFAULT 'direct' NOT NULL,
  "referrer" text DEFAULT '' NOT NULL,
  "utm_source" text DEFAULT '' NOT NULL,
  "utm_medium" text DEFAULT '' NOT NULL,
  "utm_campaign" text DEFAULT '' NOT NULL
);
CREATE INDEX IF NOT EXISTS "analytics_sessions_started_idx" ON "analytics_sessions" ("project_id", "started_at");
CREATE INDEX IF NOT EXISTS "analytics_sessions_anon_idx" ON "analytics_sessions" ("project_id", "anon_id");

CREATE TABLE IF NOT EXISTS "analytics_pageviews" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "session_id" text NOT NULL,
  "anon_id" text NOT NULL,
  "host" text DEFAULT '' NOT NULL,
  "path" text NOT NULL,
  "device" text DEFAULT 'desktop' NOT NULL,
  "duration_ms" integer DEFAULT 0 NOT NULL,
  "events" text[] DEFAULT '{}' NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);
CREATE INDEX IF NOT EXISTS "analytics_pv_project_idx" ON "analytics_pageviews" ("project_id", "created_at");

CREATE TABLE IF NOT EXISTS "analytics_views" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "user_id" text REFERENCES "users"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "goal" text DEFAULT '' NOT NULL,
  "shared" boolean DEFAULT false NOT NULL,
  "config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "analytics_views_project_idx" ON "analytics_views" ("project_id");

-- Heatmaps: fração de sessões gravadas (amostragem para caber na cota do plano e no custo).
ALTER TABLE "heatmap_pageviews" ADD COLUMN IF NOT EXISTS "sample_rate" real DEFAULT 1 NOT NULL;
