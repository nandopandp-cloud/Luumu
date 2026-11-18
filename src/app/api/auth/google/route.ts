import { NextResponse } from "next/server";
import { googleSsoEnabled, startGoogleLogin } from "@/lib/auth/google-sso";
import { safeNext } from "@/lib/auth/next";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/auth/google?next=/rota — começa o login com Google (lib/auth/google-sso.ts). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!googleSsoEnabled()) return NextResponse.redirect(new URL("/login?error=google_off", url.origin));
  const target = await startGoogleLogin(url.origin, safeNext(url.searchParams.get("next")));
  return NextResponse.redirect(target);
}
