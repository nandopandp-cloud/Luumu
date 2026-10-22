CREATE TABLE IF NOT EXISTS "scheduled_reports" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL,
  "project_id" text NOT NULL,
  "name" text NOT NULL,
  "recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "frequency" text DEFAULT 'weekly' NOT NULL,
  "period" text DEFAULT '30d' NOT NULL,
  "format" text DEFAULT 'pdf' NOT NULL,
  "survey_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "last_run_at" timestamp with time zone,
  "next_run_at" timestamp with time zone NOT NULL,
  "created_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public_reports" (
  "id" text PRIMARY KEY NOT NULL,
  "token" text NOT NULL,
  "workspace_id" text NOT NULL,
  "project_id" text NOT NULL,
  "survey_id" text,
  "period" text DEFAULT 'all' NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "view_count" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "public_reports_token_unique" UNIQUE("token")
);

ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "public_reports" ADD CONSTRAINT "public_reports_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "public_reports" ADD CONSTRAINT "public_reports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "public_reports" ADD CONSTRAINT "public_reports_survey_id_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."surveys"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "public_reports" ADD CONSTRAINT "public_reports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "scheduled_reports_project_idx" ON "scheduled_reports" ("project_id");
CREATE INDEX IF NOT EXISTS "scheduled_reports_next_run_idx" ON "scheduled_reports" ("next_run_at");
CREATE INDEX IF NOT EXISTS "public_reports_project_idx" ON "public_reports" ("project_id");
