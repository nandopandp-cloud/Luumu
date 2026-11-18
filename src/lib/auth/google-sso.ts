import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { productReportSettings, projects } from "@/lib/db/schema";
import { findUserByEmail, getUserWorkspace, provisionViewer } from "@/lib/db/users";
import { getProductReportSettings } from "@/lib/db/product-report";
import {
  checkGoogleClaims,
  GOOGLE_ISSUERS,
  GOOGLE_JWKS_URL,
  GOOGLE_TOKEN_URL,
  googleAuthUrl,
  jgProjectIds,
  type GoogleLoginError,
} from "./google";

/*
  Login com Google (OAuth 2.0 / OpenID Connect, fluxo "authorization code" com PKCE). As regras
  puras (domínio, claims, projetos) estão em ./google.ts; as rotas em app/api/auth/google.

  1. /api/auth/google gera state, nonce e code_verifier, guarda num cookie httpOnly de 10 min e
     manda para o Google.
  2. /api/auth/google/callback confere o state, troca o código pelo id_token (com o verifier),
     verifica a assinatura pelas chaves públicas do Google e confere nonce, e-mail verificado e
     domínio @jovensgenios.com.
  3. Conta existente com o mesmo e-mail: entra nela (papel e projetos de sempre). Conta nova: é
     criada como Leitor no workspace da Jovens Gênios, vendo só GenieX, Exploradores e Educadores.

  Variáveis: GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET (obrigatórias para o botão aparecer) e
  GOOGLE_SSO_WORKSPACE_ID (opcional; sem ela vale o workspace configurado no Report Quinzenal).
*/

const FLOW_COOKIE = "luumu_google_oauth";
const FLOW_TTL_SEC = 600;

export function googleSsoEnabled(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/** Callback na mesma origem que iniciou o login (cada domínio precisa estar cadastrado no Google). */
export const callbackUrl = (origin: string) => `${origin}/api/auth/google/callback`;

const b64url = (buf: Buffer) => buf.toString("base64url");

interface Flow {
  state: string;
  nonce: string;
  verifier: string;
  next: string;
}

/** Começa o login: grava o cookie do fluxo e devolve a URL do Google. */
export async function startGoogleLogin(origin: string, next: string): Promise<string> {
  const flow: Flow = { state: b64url(randomBytes(24)), nonce: b64url(randomBytes(24)), verifier: b64url(randomBytes(48)), next };
  (await cookies()).set(FLOW_COOKIE, JSON.stringify(flow), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // lax: o retorno do Google é uma navegação de topo (GET), que leva o cookie
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: FLOW_TTL_SEC,
  });
  return googleAuthUrl({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    redirectUri: callbackUrl(origin),
    state: flow.state,
    nonce: flow.nonce,
    codeChallenge: b64url(createHash("sha256").update(flow.verifier).digest()),
  });
}

/** Lê e apaga o cookie do fluxo (uso único). */
export async function takeFlow(): Promise<Flow | null> {
  const store = await cookies();
  const raw = store.get(FLOW_COOKIE)?.value;
  store.delete({ name: FLOW_COOKIE, path: "/api/auth/google" });
  if (!raw) return null;
  try {
    const f = JSON.parse(raw) as Partial<Flow>;
    return f.state && f.nonce && f.verifier ? { state: f.state, nonce: f.nonce, verifier: f.verifier, next: f.next ?? "/dashboard" } : null;
  } catch {
    return null;
  }
}

const jwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));

/** Troca o código pelo id_token e devolve e-mail e nome já conferidos. */
export async function verifyGoogleCode(
  code: string,
  flow: Flow,
  origin: string
): Promise<{ ok: true; email: string; name: string } | { ok: false; error: GoogleLoginError }> {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: callbackUrl(origin),
      grant_type: "authorization_code",
      code_verifier: flow.verifier,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    console.error("[google-sso] troca do código falhou:", res.status);
    return { ok: false, error: "google_failed" };
  }
  const { id_token } = (await res.json()) as { id_token?: string };
  if (!id_token) return { ok: false, error: "google_failed" };
  try {
    const { payload } = await jwtVerify(id_token, jwks, { issuer: GOOGLE_ISSUERS, audience: clientId });
    return checkGoogleClaims(payload as Record<string, unknown>, flow.nonce);
  } catch (e) {
    console.error("[google-sso] id_token inválido:", e instanceof Error ? e.message.slice(0, 200) : e);
    return { ok: false, error: "google_failed" };
  }
}

/** Workspace onde contas novas do Google entram: o da env ou o único com Report Quinzenal configurado. */
async function ssoWorkspaceId(): Promise<string | null> {
  const fromEnv = process.env.GOOGLE_SSO_WORKSPACE_ID?.trim();
  if (fromEnv) return fromEnv;
  const rows = await db.select({ id: productReportSettings.workspaceId }).from(productReportSettings).limit(2);
  return rows.length === 1 ? rows[0].id : null;
}

/** Conta do e-mail (criando-a como Leitor se não existir) e o workspace da sessão. */
export async function googleAccount(
  email: string,
  name: string
): Promise<{ ok: true; user: { id: string; email: string; name: string }; workspaceId: string } | { ok: false; error: GoogleLoginError }> {
  let user = await findUserByEmail(email);
  if (!user) {
    const workspaceId = await ssoWorkspaceId();
    if (!workspaceId) return { ok: false, error: "google_no_access" };
    const [settings, rows] = await Promise.all([
      getProductReportSettings(workspaceId).catch(() => ({ platformProjects: {} })),
      db.select({ id: projects.id, name: projects.name }).from(projects).where(and(eq(projects.workspaceId, workspaceId))),
    ]);
    const projectIds = jgProjectIds(settings.platformProjects, rows);
    // sem projeto da Jovens Gênios a conta veria tudo (escopo vazio): não cria
    if (!projectIds.length) return { ok: false, error: "google_no_access" };
    try {
      await provisionViewer({ workspaceId, name, email, password: b64url(randomBytes(32)), projectIds });
    } catch (e) {
      // dois logins simultâneos: o outro criou a conta (e-mail é único); segue com ela
      if (!(await findUserByEmail(email))) throw e;
    }
    user = await findUserByEmail(email);
    if (!user) return { ok: false, error: "google_failed" };
    console.info(`[google-sso] conta criada como Leitor (${projectIds.length} projetos)`);
  }
  const ws = await getUserWorkspace(user.id);
  if (!ws) return { ok: false, error: "google_no_access" };
  return { ok: true, user: { id: user.id, email: user.email, name: user.name }, workspaceId: ws.workspaceId };
}
