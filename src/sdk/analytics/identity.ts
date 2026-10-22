/*
  Quem é o usuário, a partir do que o produto passou em Luumu.identify. Aceita os nomes de campo
  mais comuns (snake, camel e em português) para nome e foto, sem exigir que o cliente mude o
  formato do objeto que já tem. PURO: roda no core do SDK e nos testes.
*/
export interface Who {
  id: string | null;
  email: string | null;
  name: string | null;
  avatar: string | null;
}

const NAME = ["name", "full_name", "fullName", "displayName", "display_name", "nome", "nome_completo"];
const FIRST = ["first_name", "firstName", "given_name", "primeiro_nome"];
const LAST = ["last_name", "lastName", "family_name", "sobrenome"];
const AVATAR = ["avatar", "avatar_url", "avatarUrl", "picture", "photo", "photo_url", "photoUrl", "photoURL", "image", "image_url", "imageUrl", "foto"];

export function whoFrom(traits: Record<string, unknown>): Who {
  const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const pick = (keys: string[]) => keys.reduce<string | null>((found, k) => found ?? s(traits[k]), null);
  const parts = [pick(FIRST), pick(LAST)].filter(Boolean).join(" ");
  const avatar = pick(AVATAR);
  return {
    id: s(traits.id),
    email: s(traits.email),
    name: pick(NAME) ?? (parts || null),
    // só https: http seria bloqueado no painel e data: pesaria em todo envio
    avatar: avatar && /^https:\/\//i.test(avatar) ? avatar : null,
  };
}
