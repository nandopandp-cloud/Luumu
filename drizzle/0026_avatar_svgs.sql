-- Avatares desenhados direto na página (SVG embutido, sem endereço de imagem — Exploradores e
-- Geniex): uma cópia por desenho e projeto (muitos alunos usam o mesmo personagem). Servidos como
-- imagem em /api/v1/avatars/<projeto>/<impressão>.svg, com cache longo na CDN.
CREATE TABLE IF NOT EXISTS "avatar_svgs" (
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "hash" text NOT NULL,
  "svg" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("project_id", "hash")
);
