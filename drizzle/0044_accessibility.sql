-- Plugin de Acessibilidade (lib/accessibility, docs/accessibility). Tabelas novas; o código no
-- ar funciona sem elas — o /config manda o plugin desligado e a tela /accessibility mostra um
-- aviso apontando esta migração.

-- Configuração por projeto. `config` guarda o JSON normalizado por lib/accessibility/config.ts.
-- `identity_secret` assina o ID do estudante (HMAC, no backend do cliente) e nunca sai do servidor.
CREATE TABLE IF NOT EXISTS "accessibility_settings" (
  "project_id" text PRIMARY KEY REFERENCES "projects"("id") ON DELETE cascade,
  "enabled" boolean NOT NULL DEFAULT false,
  "config" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "identity_secret" text,
  "require_verified" boolean NOT NULL DEFAULT false,
  "updated_by" text REFERENCES "users"("id") ON DELETE set null,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Estudantes convidados (lista individual). Dado sensível (LGPD): só o servidor lê.
CREATE TABLE IF NOT EXISTS "accessibility_invitees" (
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "user_key" text NOT NULL,
  "name" text NOT NULL DEFAULT '',
  "profile" text,
  "status" text NOT NULL DEFAULT 'pending',
  "last_event_at" timestamptz,
  "created_by" text REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("project_id", "user_key")
);
CREATE INDEX IF NOT EXISTS "accessibility_invitees_created_idx" ON "accessibility_invitees" ("project_id", "created_at");

-- Preferências de cada estudante, em qualquer aparelho. `user_hash` = sha256(projeto + ID):
-- o ID não fica em claro ao lado das necessidades de acessibilidade.
CREATE TABLE IF NOT EXISTS "accessibility_user_prefs" (
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "user_hash" text NOT NULL,
  "prefs" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("project_id", "user_hash")
);
