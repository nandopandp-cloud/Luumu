-- Limpa nomes/fotos capturados ERRADO pela detecção automática da página (versão inicial):
-- mascote ("Genie Bot"), ícones de matéria ("Knowledge Area"), personagens ("Astra avatar"),
-- fundo do perfil e o nome/foto de um colega visto em ranking. A tela já ignora esses valores
-- (lib/db/analytics.ts); isto só os apaga do banco. Pode rodar mais de uma vez.

-- 1) o mesmo valor em 2+ pessoas diferentes do projeto não é de ninguém
UPDATE "analytics_users" u SET "user_avatar" = NULL
 WHERE u."user_avatar" IS NOT NULL AND EXISTS (
   SELECT 1 FROM "analytics_users" x
    WHERE x."project_id" = u."project_id" AND x."user_avatar" = u."user_avatar"
      AND coalesce(x."user_id", x."user_email", x."anon_id") <> coalesce(u."user_id", u."user_email", u."anon_id"));

UPDATE "analytics_users" u SET "user_name" = NULL
 WHERE u."user_name" IS NOT NULL AND EXISTS (
   SELECT 1 FROM "analytics_users" x
    WHERE x."project_id" = u."project_id" AND x."user_name" = u."user_name"
      AND coalesce(x."user_id", x."user_email", x."anon_id") <> coalesce(u."user_id", u."user_email", u."anon_id"));

-- 2) ilustração/ícone não é foto de gente (mesmas regras de lib/analytics/identity-filter.ts)
UPDATE "analytics_users" SET "user_avatar" = NULL
 WHERE "user_avatar" ~* '\.svg($|\?)'
    OR "user_avatar" ~* '/(icons?|battles?|apps-images|static|emojis?|flags?|badges?|mascots?|logos?|backgrounds?|banners?)/'
    OR "user_avatar" ~* '(logo|mascot|bot|banner|background|placeholder|default[-_]?avatar|icon)[^/]*$';

-- 3) rótulo de interface/ilustração não é nome; "Fulano avatar" vira "Fulano"
UPDATE "analytics_users" SET "user_name" = NULL
 WHERE "user_name" ~* '\m(bot|mascote|area|área|knowledge|background|fundo|banner|nação|nacao|vídeo|video|ícone|icone|icon|logo|imagem|image|perfil|profile|ver)\M'
    AND "user_name" !~* '^.+ avatar$';
UPDATE "analytics_users" SET "user_name" = NULLIF(trim(regexp_replace("user_name", '\s+avatar$', '', 'i')), '')
 WHERE "user_name" ~* '\s+avatar$';
-- nome de uma palavra só (personagens: "Astra", "Yugen") não é nome completo
UPDATE "analytics_users" SET "user_name" = NULL
 WHERE "user_name" IS NOT NULL AND "user_name" !~ '\s';
