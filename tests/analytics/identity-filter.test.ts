/*
  O que NÃO é nome/foto de pessoa (lib/analytics/identity-filter.ts), com os valores reais que a
  primeira versão da captura automática gravou por engano.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { isJunkAvatar, isJunkName, stripNameNoise } from "../../lib/analytics/identity-filter";

test("nomes: ruído removido, rótulos de interface e personagens rejeitados", () => {
  assert.equal(stripNameNoise("ALEXANDRE BORGES CESARINO FERREIRA avatar"), "ALEXANDRE BORGES CESARINO FERREIRA");
  assert.equal(stripNameNoise("Avatar de Ana Souza"), "Ana Souza");
  for (const junk of ["Genie Bot", "Knowledge Area", "Background de perfil", "Avatar da nação Yugen", "Ver vídeo", "Foto de perfil"]) assert.ok(isJunkName(stripNameNoise(junk)), junk);
  for (const real of ["JULIANA DIAS NASCIMENTO", "César Yushin Udo Coelho Medeiros", "Ana Souza"]) assert.ok(!isJunkName(real), real);
});

test("fotos: ilustração, ícone e asset do app não são foto de gente", () => {
  for (const junk of [
    "https://preparasp.jovensgenios.com/icons/genie-bot-02.svg?dpl=gx-1",
    "https://squad.jovensgenios.com/battles/vs/astra-avatar.svg",
    "https://jg-internal-files-s3.jovensgenios.com/apps-images/exploradores-mobile/icons/math_circle_outline.png",
    "https://cdn.app.com/_next/static/media/logo.png",
    "https://cdn.app.com/img/default-avatar.png",
  ])
    assert.ok(isJunkAvatar(junk), junk);
  for (const real of ["https://files-s3.jovensgenios.com/avatar_df076435-8701-4f90-85ca-23ad21e225c4.png", "https://files-s3.jovensgenios.com/4766db46-f1db-4afc-9b11-e6588f19825a.png", "https://lh3.googleusercontent.com/a/ACg8ocK"])
    assert.ok(!isJunkAvatar(real), real);
});
