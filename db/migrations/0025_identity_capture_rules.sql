-- Como encontrar nome e foto do usuário na tela: POR PROJETO e, se preciso, POR PLATAFORMA
-- (cada produto tem seu HTML: Geniex ≠ Exploradores ≠ Educadores). host '' = padrão para todas
-- as plataformas do projeto. Sem linha = detecção automática. Ligar/desligar a captura continua
-- sendo da workspace (identity_capture_settings.enabled).
CREATE TABLE IF NOT EXISTS "identity_capture_rules" (
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "host" text DEFAULT '' NOT NULL,
  "mode" text DEFAULT 'auto' NOT NULL,
  "name_selector" text DEFAULT '' NOT NULL,
  "avatar_selector" text DEFAULT '' NOT NULL,
  "updated_by" text REFERENCES "users"("id") ON DELETE set null,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("project_id", "host")
);

-- Seletores já salvos no formato anterior (um para a workspace inteira) eram os do menu do
-- usuário da Geniex: viram o padrão do projeto Geniex, em vez de valer para todos os produtos.
INSERT INTO "identity_capture_rules" ("project_id", "host", "mode", "name_selector", "avatar_selector")
SELECT p."id", '', 'selectors', s."name_selector", s."avatar_selector"
  FROM "identity_capture_settings" s
  JOIN "projects" p ON p."workspace_id" = s."workspace_id"
 WHERE p."name" = 'Geniex' AND (s."name_selector" <> '' OR s."avatar_selector" <> '')
ON CONFLICT ("project_id", "host") DO NOTHING;
