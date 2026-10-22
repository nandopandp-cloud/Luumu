-- Segunda limpeza dos avatares desenhados: a versão anterior do SDK, em telas onde o seletor do
-- avatar não casava por inteiro, fotografava o elemento errado (botão de voltar, ícone de olho,
-- moeda) e isso virou "avatar" de vários alunos. O SDK atual só fotografa o que o seletor casa por
-- inteiro. RODE DEPOIS DO DEPLOY (e ~1 h depois, o tempo dos navegadores trocarem de SDK); fotos com
-- endereço (https) não são tocadas.
UPDATE "analytics_users" SET "user_avatar" = NULL WHERE "user_avatar" LIKE '/api/v1/avatars/%';
DELETE FROM "avatar_svgs";
