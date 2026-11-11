/**
 * Plugin de Acessibilidade — Libras pelo VLibras (gov.br).
 *
 * Módulo PURO. O VLibras é o tradutor oficial do governo federal: gratuito, com tradução real
 * (português → glosa → sinais animados num avatar 3D, ~21 mil sinais) e três avatares (Ícaro,
 * Hosana e Guga). Documentação: https://www.vlibras.gov.br/doc/widget/
 *
 * Personalização (cores e logo na camisa): pelas regras do projeto, é EXCLUSIVA de
 * instituições parceiras e precisa de aprovação (pedido por e-mail). Depois de aprovada, o
 * VLibras entrega um endereço de personalização, que o cliente cola no painel da Luumu. A
 * Luumu não gera nem hospeda personalização por conta própria: este módulo só monta o PEDIDO
 * no formato do VLibras, a partir das cores escolhidas no painel.
 */

export const VLIBRAS_SCRIPT = "https://vlibras.gov.br/app/vlibras-plugin.js";
export const VLIBRAS_REQUEST_EMAIL = "cgpsp@economia.gov.br";
export const VLIBRAS_DOCS = "https://www.vlibras.gov.br/doc/widget/functionalities/customize-avatar.html";

export type VlibrasAvatar = "icaro" | "hosana" | "guga" | "random";

export const VLIBRAS_AVATARS: { value: VlibrasAvatar; label: string; hint: string }[] = [
  { value: "icaro", label: "Ícaro", hint: "Avatar padrão do VLibras" },
  { value: "hosana", label: "Hosana", hint: "Avatar feminino" },
  { value: "guga", label: "Guga", hint: "Avatar infantil, bom para o Fundamental I" },
  { value: "random", label: "Aleatório", hint: "Um dos três a cada visita" },
];

/** Logo na camisa: critérios do VLibras para a personalização. */
export const VLIBRAS_LOGO_SPEC = { size: 500, margin: 75, format: "PNG sem fundo" } as const;

export const SKIN_TONES = [
  { value: "#F8D5C2", label: "Clara" },
  { value: "#EDB98A", label: "Média clara" },
  { value: "#C18471", label: "Média (padrão do VLibras)" },
  { value: "#AE5D29", label: "Morena" },
  { value: "#7B4122", label: "Escura" },
  { value: "#4F2A16", label: "Retinta" },
];

export const HAIR_COLORS = [
  { value: "#000000", label: "Preto" },
  { value: "#5A3825", label: "Castanho" },
  { value: "#A0522D", label: "Acobreado" },
  { value: "#D9B26F", label: "Loiro" },
  { value: "#9CA3AF", label: "Grisalho" },
];

export const SHIRT_PRESETS = ["#1A1A1A", "#4F46E5", "#6B2BD9", "#0EA5E9", "#0F766E", "#16A34A", "#F59E0B", "#E11D48", "#FFFFFF"];
export const PANTS_PRESETS = ["#201E62", "#1F2937", "#1E3A8A", "#374151", "#78350F", "#0F172A"];

/** Cores que o cliente quer no avatar (só viram realidade depois da aprovação do VLibras). */
export interface VlibrasLook {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  /** imagem da logo já resolvida; vazio = camisa lisa */
  logoUrl: string;
  logoPosition: "center" | "chest";
}

/**
 * O arquivo de personalização no formato do VLibras (mesmas chaves do exemplo oficial
 * vlibras.gov.br/config/default_logo.json), para ir no pedido de parceria.
 */
export function vlibrasPersonalizationJson(look: VlibrasLook): Record<string, string> {
  const out: Record<string, string> = {
    calca: look.pants,
    camisa: look.shirt,
    cabelo: look.hair,
    corpo: look.skin,
    iris: "#000000",
    olhos: "#FFFFFF",
    sombrancelhas: look.hair,
    pos: look.logoPosition,
  };
  if (look.logoUrl) out.logo = look.logoUrl;
  return out;
}

/** Texto do e-mail de pedido de personalização (o cliente revisa e envia). */
export function vlibrasRequestEmail(input: { institution: string; sites: string[]; look: VlibrasLook }): { to: string; subject: string; body: string } {
  const sites = input.sites.length ? input.sites.map((s) => `- ${s}`).join("\n") : "- (informe os endereços do site)";
  const json = JSON.stringify(vlibrasPersonalizationJson(input.look), null, 2);
  return {
    to: VLIBRAS_REQUEST_EMAIL,
    subject: `Pedido de personalização do avatar VLibras: ${input.institution}`,
    body: `Olá, equipe VLibras.

Somos ${input.institution} e usamos o VLibras Widget na nossa plataforma de estudos. Gostaríamos de solicitar a personalização dos avatares para os seguintes endereços:

${sites}

Personalização desejada (no formato do arquivo de configuração do widget):

${json}

${input.look.logoUrl ? `A logo para a camisa segue em anexo (PNG ${VLIBRAS_LOGO_SPEC.size}×${VLIBRAS_LOGO_SPEC.size} px, sem fundo, com margem de ${VLIBRAS_LOGO_SPEC.margin} px), posicionada ${input.look.logoPosition === "center" ? "no centro" : "no peito"} da camisa.\n\n` : ""}Ficamos à disposição para apoiar o projeto no que for preciso.

Obrigado!`,
  };
}

/**
 * Endereço de personalização entregue pelo VLibras depois da aprovação. Só https e só um
 * arquivo .json (é o que o widget repassa ao avatar 3D).
 */
export function safePersonalizationUrl(v: unknown): string {
  if (typeof v !== "string") return "";
  const s = v.trim();
  return /^https:\/\/[^\s"'<>]+\.json(\?[^\s"'<>]*)?$/i.test(s) && s.length <= 500 ? s : "";
}
