-- Cores favoritas da workspace no editor de aparência das pesquisas (lib/db/color-favorites.ts).
-- Tabela nova; sem ela o painel funciona normalmente e só o botão de favoritar fica indisponível.
CREATE TABLE IF NOT EXISTS "color_favorites" (
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "color" text NOT NULL,
  "created_by" text REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_id", "color")
);
