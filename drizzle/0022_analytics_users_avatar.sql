-- Foto do usuário (Luumu.identify({ avatar })) na aba Usuários do Analytics.
-- Repete as colunas da 0021 (IF NOT EXISTS): rodar só esta já deixa a tabela completa.
ALTER TABLE "analytics_users" ADD COLUMN IF NOT EXISTS "user_email" text;
ALTER TABLE "analytics_users" ADD COLUMN IF NOT EXISTS "user_name" text;
ALTER TABLE "analytics_users" ADD COLUMN IF NOT EXISTS "user_avatar" text;

-- Usuários já vistos antes de a coleta guardar o e-mail: completa com o e-mail que o mesmo
-- ID informou ao responder uma pesquisa no projeto (o mais recente).
UPDATE "analytics_users" u
   SET "user_email" = r."respondent_email"
  FROM (
    SELECT DISTINCT ON (s."project_id", r."respondent") s."project_id", r."respondent", lower(r."respondent_email") AS "respondent_email"
      FROM "responses" r
      JOIN "surveys" s ON s."id" = r."survey_id"
     WHERE r."respondent" IS NOT NULL AND r."respondent_email" IS NOT NULL
     ORDER BY s."project_id", r."respondent", r."created_at" DESC
  ) r
 WHERE u."user_email" IS NULL
   AND u."user_id" IS NOT NULL
   AND u."project_id" = r."project_id"
   AND u."user_id" = r."respondent";
