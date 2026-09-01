-- Escopo de projetos por membro.
-- Sem linhas para uma membership = acesso a todos os projetos (padrão histórico);
-- com linhas = acesso somente aos projetos listados. O owner ignora a tabela.
CREATE TABLE IF NOT EXISTS "membership_projects" (
  "id" text PRIMARY KEY NOT NULL,
  "membership_id" text NOT NULL,
  "project_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "membership_projects" ADD CONSTRAINT "membership_projects_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "membership_projects" ADD CONSTRAINT "membership_projects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;

CREATE UNIQUE INDEX IF NOT EXISTS "membership_projects_uidx" ON "membership_projects" ("membership_id","project_id");
CREATE INDEX IF NOT EXISTS "membership_projects_membership_idx" ON "membership_projects" ("membership_id");
CREATE INDEX IF NOT EXISTS "membership_projects_project_idx" ON "membership_projects" ("project_id");
