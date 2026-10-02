-- Plataformas (hostnames) por projeto: uma mesma SDK key pode rodar em vários produtos do
-- cliente, e cada pesquisa pode ser direcionada a um ou mais deles.
CREATE TABLE IF NOT EXISTS "project_hosts" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "host" text NOT NULL,
  "first_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "project_hosts_project_host_uidx" ON "project_hosts" ("project_id", "host");

-- [] = a pesquisa aparece em todas as plataformas do projeto (comportamento anterior)
ALTER TABLE "surveys" ADD COLUMN IF NOT EXISTS "target_hosts" jsonb DEFAULT '[]'::jsonb NOT NULL;

-- plataforma de onde veio cada resposta (null = link público ou resposta anterior a esta coluna)
ALTER TABLE "responses" ADD COLUMN IF NOT EXISTS "host" text;
