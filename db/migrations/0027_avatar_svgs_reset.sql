-- Refaz os avatares desenhados capturados nas primeiras versões: na Geniex vinham só a cabeça (sem a
-- face) ou o personagem inteiro com o rosto minúsculo; no Exploradores, em várias telas, o ícone de
-- ajuda do cabeçalho no lugar do avatar. O SDK atual fotografa de novo (com foco no rosto e
-- validando que é mesmo um avatar) na próxima visita de cada pessoa. Fotos com endereço (https)
-- não são tocadas.
UPDATE "analytics_users" SET "user_avatar" = NULL WHERE "user_avatar" LIKE '/api/v1/avatars/%';
DELETE FROM "avatar_svgs";
