-- Heatmaps: chave liga/desliga por projeto, visitas coletadas pelo SDK e a cópia de cada página.
-- A coleta começa DESLIGADA em todo projeto (alguém precisa ativar no painel).
CREATE TABLE IF NOT EXISTS "heatmap_settings" (
  "project_id" text PRIMARY KEY NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "enabled" boolean DEFAULT false NOT NULL,
  "updated_by" text REFERENCES "users"("id") ON DELETE set null,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "heatmap_pageviews" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "host" text DEFAULT '' NOT NULL,
  "path" text NOT NULL,
  "device" text NOT NULL,
  "session_id" text NOT NULL,
  "viewport_w" integer DEFAULT 0 NOT NULL,
  "viewport_h" integer DEFAULT 0 NOT NULL,
  "doc_h" integer DEFAULT 0 NOT NULL,
  "duration_ms" integer DEFAULT 0 NOT NULL,
  "max_scroll" integer DEFAULT 0 NOT NULL,
  "max_move" integer DEFAULT 0 NOT NULL,
  "clicks" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "moves" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "hovers" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "labels" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "click_path" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "heatmap_pv_page_idx" ON "heatmap_pageviews" ("project_id", "host", "path", "created_at");
CREATE INDEX IF NOT EXISTS "heatmap_pv_ws_idx" ON "heatmap_pageviews" ("workspace_id", "created_at");

CREATE TABLE IF NOT EXISTS "heatmap_snapshots" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "host" text DEFAULT '' NOT NULL,
  "path" text NOT NULL,
  "device" text NOT NULL,
  "width" integer NOT NULL,
  "height" integer NOT NULL,
  "viewport_h" integer DEFAULT 0 NOT NULL,
  "html" text NOT NULL,
  "bytes" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "heatmap_snap_page_uq" ON "heatmap_snapshots" ("project_id", "host", "path", "device");
