-- Captura de nome e foto do usuário a partir da própria página do produto (sem mudar o
-- Luumu.identify do cliente). Vale para a workspace inteira: todos os projetos e plataformas.
-- Começa DESLIGADA; um dono/administrador liga em Configurações → SDK & Eventos.
CREATE TABLE IF NOT EXISTS "identity_capture_settings" (
  "workspace_id" text PRIMARY KEY NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "enabled" boolean DEFAULT false NOT NULL,
  "name_selector" text DEFAULT '' NOT NULL,
  "avatar_selector" text DEFAULT '' NOT NULL,
  "updated_by" text REFERENCES "users"("id") ON DELETE set null,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
