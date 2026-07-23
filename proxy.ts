import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { isLockedPath } from "@/lib/locked-routes";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET);

// rotas do app que exigem sessão
const PROTECTED = [
  "/dashboard", "/surveys", "/responses", "/heatmaps", "/replay",
  "/analytics", "/insights", "/reports", "/integrations", "/sdk", "/settings",
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const needsAuth = PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (!needsAuth) return NextResponse.next();

  const token = req.cookies.get("luumu_session")?.value;
  let valid = false;
  if (token) {
    try {
      await jwtVerify(token, secret);
      valid = true;
    } catch {
      valid = false;
    }
  }
  if (!valid) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // áreas ainda sem fonte de dados real — bloqueadas mesmo por acesso direto à URL
  if (isLockedPath(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // não intercepta assets, api, sdk.js, s/[id], demo
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sdk.js|mascot|s/|demo).*)"],
};
