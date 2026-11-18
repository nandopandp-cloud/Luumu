import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { INTRO_COOKIE } from "@/components/intro/cookie";
import { googleAccount, googleSsoEnabled, takeFlow, verifyGoogleCode } from "@/lib/auth/google-sso";
import type { GoogleLoginError } from "@/lib/auth/google";
import { safeNext } from "@/lib/auth/next";
import { createSession } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/api/ratelimit";
import { isDbUnavailable } from "@/lib/db/unavailable";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/auth/google/callback — retorno do Google. Confere state, troca o código, valida o
 * domínio e abre a sessão (lib/auth/google-sso.ts). Erros voltam para /login?error=<código>.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const fail = (code: GoogleLoginError) => NextResponse.redirect(new URL(`/login?error=${code}`, url.origin));
  if (!googleSsoEnabled()) return fail("google_off");

  // o cookie do fluxo é de uso único: sai já, dê certo ou não
  const flow = await takeFlow();
  if (url.searchParams.get("error")) return fail("google_cancel");
  const code = url.searchParams.get("code");
  if (!flow || !code || url.searchParams.get("state") !== flow.state) return fail("google_state");

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
  if (!(await checkRateLimit(`login:google:${ip}`, 20, 60))) return fail("google_rate");

  try {
    const google = await verifyGoogleCode(code, flow, url.origin);
    if (!google.ok) return fail(google.error);
    const account = await googleAccount(google.email, google.name);
    if (!account.ok) return fail(account.error);
    await createSession({ userId: account.user.id, workspaceId: account.workspaceId, email: account.user.email, name: account.user.name });
    // primeira tela depois do login abre com a animação de entrada (como no login com senha)
    (await cookies()).set(INTRO_COOKIE, "1", { path: "/", maxAge: 120, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  } catch (e) {
    console.error("[google-sso] callback:", e instanceof Error ? e.message.slice(0, 300) : e);
    return fail(isDbUnavailable(e) ? "google_db" : "google_failed");
  }
  return NextResponse.redirect(new URL(safeNext(flow.next), url.origin));
}
