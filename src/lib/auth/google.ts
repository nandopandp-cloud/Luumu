/**
 * Login com Google (SSO), parte pura e testável: domínio permitido, URL de autorização, conferência
 * dos claims do id_token e projetos de quem entra pela primeira vez. A troca do código, a sessão e
 * a criação da conta ficam em ./google-sso.ts (servidor).
 *
 * Só contas Google Workspace do domínio da Jovens Gênios entram. O domínio é conferido no servidor
 * em dois claims assinados pelo Google: `hd` (domínio da conta Workspace) e `email` (verificado).
 * O parâmetro `hd` da URL de autorização só filtra a tela de escolha de conta e não protege nada.
 */
import { PLATFORMS, type PlatformKey } from "@/lib/product-report/indicators";

export const SSO_DOMAIN = "jovensgenios.com";

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
export const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

/** E-mail exatamente do domínio (sem subdomínio, sem "jovensgenios.com.outro.com"). */
export function isAllowedEmail(email: unknown): email is string {
  if (typeof email !== "string") return false;
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  return at > 0 && e.slice(at + 1) === SSO_DOMAIN;
}

export function googleAuthUrl(p: { clientId: string; redirectUri: string; state: string; nonce: string; codeChallenge: string }): string {
  const q = new URLSearchParams({
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: p.state,
    nonce: p.nonce,
    code_challenge: p.codeChallenge,
    code_challenge_method: "S256",
    // só sugere contas do domínio na tela do Google; a regra de verdade é checkGoogleClaims
    hd: SSO_DOMAIN,
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH_URL}?${q}`;
}

export type GoogleLoginError =
  | "google_off" // SSO não configurado (faltam as variáveis do Google)
  | "google_cancel" // a pessoa cancelou na tela do Google
  | "google_state" // state ausente/diferente (link velho, outra aba, ou tentativa forjada)
  | "google_failed" // troca do código ou verificação do token falhou
  | "google_domain" // conta fora de @jovensgenios.com
  | "google_no_access" // conta nova e não há para onde provisionar
  | "google_rate" // tentativas demais
  | "google_db"; // banco indisponível

export const GOOGLE_ERROR_MESSAGE: Record<GoogleLoginError, string> = {
  google_off: "O login com Google ainda não está disponível.",
  google_cancel: "Login com Google cancelado.",
  google_state: "O login com Google expirou. Tente de novo.",
  google_failed: "Não foi possível entrar com o Google. Tente de novo.",
  google_domain: `Só contas @${SSO_DOMAIN} podem entrar com o Google.`,
  google_no_access: "Sua conta ainda não tem acesso à Luumu. Peça a quem administra o workspace.",
  google_rate: "Muitas tentativas. Aguarde um minuto e tente novamente.",
  google_db: "Serviço temporariamente indisponível. Tente novamente em alguns minutos.",
};

export function isGoogleLoginError(code: unknown): code is GoogleLoginError {
  return typeof code === "string" && Object.hasOwn(GOOGLE_ERROR_MESSAGE, code);
}

/**
 * Confere os claims de um id_token JÁ verificado (assinatura, emissor, audiência e validade pelo
 * jose). Exige o nonce desta tentativa, e-mail verificado e o domínio nos dois claims.
 */
export function checkGoogleClaims(
  claims: Record<string, unknown>,
  nonce: string
): { ok: true; email: string; name: string } | { ok: false; error: GoogleLoginError } {
  if (!nonce || claims.nonce !== nonce) return { ok: false, error: "google_state" };
  if (claims.email_verified !== true) return { ok: false, error: "google_domain" };
  if (claims.hd !== SSO_DOMAIN || !isAllowedEmail(claims.email)) return { ok: false, error: "google_domain" };
  const email = (claims.email as string).trim().toLowerCase();
  const name = typeof claims.name === "string" && claims.name.trim() ? claims.name.trim() : email.split("@")[0];
  return { ok: true, email, name: name.slice(0, 120) };
}

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Projetos que uma conta criada pelo Google pode ver: GenieX, Exploradores e Educadores. Vale o
 * projeto ligado a cada plataforma no Report Quinzenal; sem ligação, o projeto com o nome dela.
 * Lista vazia = nenhum encontrado, e quem chama NÃO cria a conta (escopo vazio = todos os projetos).
 */
export function jgProjectIds(
  platformProjects: Partial<Record<PlatformKey, string>>,
  projects: { id: string; name: string }[]
): string[] {
  const ids = PLATFORMS.map((p) => {
    const mapped = platformProjects[p.key];
    if (mapped && projects.some((x) => x.id === mapped)) return mapped;
    return projects.find((x) => plain(x.name).includes(plain(p.label)))?.id;
  });
  return Array.from(new Set(ids.filter((x): x is string => !!x)));
}
