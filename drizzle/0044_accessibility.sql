-- Plugin de Acessibilidade: configuração por projeto (recursos, aparência, avatar de Libras e
-- convite aos estudantes). Uma tabela nova; o código no ar funciona sem ela — o /config manda
-- o plugin desligado e a tela /accessibility mostra um aviso apontando esta migração.
--
-- `config` guarda o JSON normalizado por lib/accessibility/config.ts. A lista individual de
-- estudantes sinalizados (config.nudge.students) é dado sensível (LGPD): só o servidor a lê;
-- o /config público manda apenas `hasList`.
CREATE TABLE IF NOT EXISTS "accessibility_settings" (
  "project_id" text PRIMARY KEY REFERENCES "projects"("id") ON DELETE cascade,
  "enabled" boolean NOT NULL DEFAULT false,
  "config" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "updated_by" text REFERENCES "users"("id") ON DELETE set null,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
