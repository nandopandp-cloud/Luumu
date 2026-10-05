/*
  O que NÃO é nome nem foto de uma pessoa. Usado no SDK (antes de enviar) e no servidor (antes
  de gravar). PURO e testado.

  Aprendido com os dados reais da captura automática: ela pegava o mascote ("Genie Bot",
  /icons/genie-bot-02.svg), ícones de matéria ("Knowledge Area", /apps-images/.../icons/),
  personagens das nações ("Astra avatar", /battles/vs/astra-avatar.svg) e o fundo do perfil
  ("Background de perfil"). Foto de gente é arquivo enviado (png/jpg/webp), não ilustração SVG
  nem asset do próprio app.
*/

// palavras que denunciam rótulo de interface/ilustração, não nome de pessoa
const JUNK_WORDS =
  /\b(bot|robo|robô|mascote|mascot|avatar|avatares|area|área|knowledge|background|fundo|banner|capa|cover|na[cç][aã]o|nation|v[ií]deo|video|[ií]cone|icon|logo|logotipo|imagem|image|foto|photo|perfil|profile|ilustra[cç][aã]o|emoji|badge|medalha|trof[eé]u|ver|clique|abrir|fechar|menu|usu[aá]rio|aluno|aluna|estudante|professor|professora)\b/i;

/** "Ana Souza avatar" → "Ana Souza"; "Avatar de Ana Souza" → "Ana Souza"; "Foto de perfil" → "". */
export function stripNameNoise(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(avatar|foto|imagem|perfil)\s+(de|da|do)\s+/i, "")
    .replace(/\s*[-–·|]?\s*(avatar|foto( de perfil)?|imagem( de perfil)?|perfil)$/i, "")
    .trim();
}

/** Texto que, mesmo com cara de nome, é rótulo/ilustração ("Genie Bot", "Knowledge Area"). */
export function isJunkName(name: string | null | undefined): boolean {
  const t = (name ?? "").trim();
  if (!t) return true;
  return JUNK_WORDS.test(t);
}

/** Endereço que não é foto de pessoa: ilustração SVG, ícone, personagem, asset do app. */
export function isJunkAvatar(url: string | null | undefined): boolean {
  const u = (url ?? "").trim().toLowerCase();
  if (!u) return true;
  let path = u;
  try {
    path = new URL(u).pathname;
  } catch {
    return true;
  }
  if (/\.svg$/.test(path)) return true;
  return /\/(icons?|battles?|apps-images|images?\/(ui|app|icons?)|static|_next\/static|assets?\/(img|images|icons?)|emojis?|flags?|badges?|mascots?|logos?|backgrounds?|banners?)\//.test(path) ||
    /(logo|mascot|mascote|bot|banner|background|placeholder|default[-_]?avatar|avatar[-_]?default|icon)[^/]*$/.test(path);
}
