-- Luumu Product Tours (ver docs/tours/ARQUITETURA.md). Só cria tabelas novas.
CREATE TABLE IF NOT EXISTS "tours" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "published_version_id" text,
  "has_unpublished_changes" boolean DEFAULT true NOT NULL,
  "created_by" text REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "tours_project_idx" ON "tours" ("project_id");

CREATE TABLE IF NOT EXISTS "tour_versions" (
  "id" text PRIMARY KEY NOT NULL,
  "tour_id" text NOT NULL REFERENCES "tours"("id") ON DELETE cascade,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "version" integer NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "published_at" timestamp with time zone,
  "published_by" text REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "tour_versions_tour_version_uidx" ON "tour_versions" ("tour_id", "version");

CREATE TABLE IF NOT EXISTS "tour_steps" (
  "id" text PRIMARY KEY NOT NULL,
  "version_id" text NOT NULL REFERENCES "tour_versions"("id") ON DELETE cascade,
  "tour_id" text NOT NULL REFERENCES "tours"("id") ON DELETE cascade,
  "key" text NOT NULL,
  "order" integer DEFAULT 0 NOT NULL,
  "type" text NOT NULL,
  "title" text DEFAULT '' NOT NULL,
  "body" text DEFAULT '' NOT NULL,
  "route" text,
  "target" jsonb,
  "config" jsonb DEFAULT '{}'::jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS "tour_steps_version_idx" ON "tour_steps" ("version_id");

CREATE TABLE IF NOT EXISTS "tour_events" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "tour_id" text NOT NULL REFERENCES "tours"("id") ON DELETE cascade,
  "version_id" text,
  "step_key" text,
  "type" text NOT NULL,
  "user_id" text,
  "anonymous_id" text,
  "session_id" text,
  "route" text,
  "host" text,
  "meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "tour_events_tour_created_idx" ON "tour_events" ("tour_id", "created_at");
CREATE INDEX IF NOT EXISTS "tour_events_project_idx" ON "tour_events" ("project_id");

CREATE TABLE IF NOT EXISTS "product_routes" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "host" text NOT NULL,
  "route" text NOT NULL,
  "title" text DEFAULT '' NOT NULL,
  "element_count" integer DEFAULT 0 NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "product_routes_uidx" ON "product_routes" ("project_id", "host", "route");

CREATE TABLE IF NOT EXISTS "product_elements" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "host" text NOT NULL,
  "route" text NOT NULL,
  "fingerprint" text NOT NULL,
  "kind" text DEFAULT 'other' NOT NULL,
  "label" text DEFAULT '' NOT NULL,
  "target" jsonb NOT NULL,
  "stability" real DEFAULT 0 NOT NULL,
  "first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "product_elements_uidx" ON "product_elements" ("project_id", "host", "route", "fingerprint");
CREATE INDEX IF NOT EXISTS "product_elements_project_idx" ON "product_elements" ("project_id");
