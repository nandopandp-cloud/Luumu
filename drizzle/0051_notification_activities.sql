-- Avisos automáticos de atividades (lib/db/notification-activities.ts, docs/notifications/INTEGRACAO.md).
-- O GenieX avisa por webhook quando libera, altera ou cancela uma Tarefa ou Prova Genial, com as
-- turmas que a recebem; o sino de cada estudante lê a lista da turma dele. Tabelas novas: sem elas
-- o webhook responde 503 e o resto das Notificações segue como antes.

-- Segredo do webhook por projeto. Na troca, o anterior segue válido por 24h (previous_until),
-- para o cliente atualizar o back-end sem perder envios.
CREATE TABLE IF NOT EXISTS "notification_webhooks" (
  "project_id" text PRIMARY KEY REFERENCES "projects"("id") ON DELETE cascade,
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "secret" text NOT NULL,
  "previous_secret" text,
  "previous_until" timestamptz,
  "updated_by" text REFERENCES "users"("id") ON DELETE set null,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Uma linha por atividade do cliente (id do cliente em external_id). occurred_at = data do último
-- evento aplicado: um evento mais antigo que chegue depois é ignorado.
CREATE TABLE IF NOT EXISTS "notification_activities" (
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "external_id" text NOT NULL,
  "type" text NOT NULL,
  "title" text NOT NULL DEFAULT '',
  "subject" text,
  "url" text NOT NULL DEFAULT '',
  "assigned_at" timestamptz NOT NULL,
  "due_at" timestamptz,
  "class_ids" text[] NOT NULL DEFAULT '{}',
  "status" text NOT NULL DEFAULT 'active',
  "occurred_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("project_id", "external_id")
);
-- feed da turma: atividades em aberto que contêm a turma
CREATE INDEX IF NOT EXISTS "notification_activities_classes_idx" ON "notification_activities" USING gin ("class_ids");
CREATE INDEX IF NOT EXISTS "notification_activities_project_idx" ON "notification_activities" ("project_id", "updated_at");

-- Registro de cada evento recebido (o painel mostra os últimos; a chave descarta repetidos).
CREATE TABLE IF NOT EXISTS "notification_webhook_deliveries" (
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "event_id" text NOT NULL,
  "event" text NOT NULL DEFAULT '',
  "activity_id" text,
  "status" text NOT NULL,
  "error" text,
  "received_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("project_id", "event_id")
);
CREATE INDEX IF NOT EXISTS "notification_webhook_deliveries_recent_idx" ON "notification_webhook_deliveries" ("project_id", "received_at");

-- Métricas dos avisos automáticos: contadores por atividade, aviso (nova | prazo), tipo e dia.
-- Sem uma linha por estudante: o navegador já manda cada (aviso, tipo) uma vez por estudante.
CREATE TABLE IF NOT EXISTS "notification_activity_stats" (
  "project_id" text NOT NULL,
  "activity_id" text NOT NULL,
  "item" text NOT NULL,
  "kind" text NOT NULL,
  "day" date NOT NULL,
  "n" integer NOT NULL DEFAULT 0,
  PRIMARY KEY ("project_id", "activity_id", "item", "kind", "day"),
  FOREIGN KEY ("project_id", "activity_id") REFERENCES "notification_activities"("project_id", "external_id") ON DELETE cascade
);
