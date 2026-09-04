import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { isLockedPath } from "@/lib/locked-routes";

// Mesma exigência de lib/auth/session.ts: sem AUTH_SECRET, `encode(undefined)` produz uma
// chave de tamanho zero e TODO jwtVerify falha — o que aqui viraria um redirect silencioso
// para /login em cada request (loop de login sem nenhum erro visível). Falhar no boot deixa
// a causa explícita em vez de virar "não consigo entrar depois do login".
const secretStr = process.env.AUTH_SECRET;
if (!secretStr) throw new Error("AUTH_SECRET não configurada.");
const secret = new TextEncoder().encode(secretStr);

// rotas do app que exigem sessão
const PROTECTED = [
  "/dashboard", "/surveys", "/responses", "/heatmaps", "/replay",
  "/analytics", "/insights", "/reports", "/integrations", "/sdk", "/settings",
];

// páginas de credencial: quem já tem sessão não deve vê-las
const AUTH_PAGES = ["/login", "/signup"];

/**
 * Valida o destino pós-login vindo da URL (`?next=`). Só aceita caminho interno de rota
 * protegida e não bloqueada: `next` é entrada do usuário, então "//evil.com" ou
 * "https://evil.com" — que o navegador trataria como host externo — viraria open redirect.
 */
function safeNext(next: string | null): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  const isProtected = PROTECTED.some((p) => next === p || next.startsWith(p + "/"));
  if (!isProtected || isLockedPath(next)) return null;
  return next;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const needsAuth = PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const isAuthPage = AUTH_PAGES.includes(pathname);
  if (!needsAuth && !isAuthPage) return NextResponse.next();

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
  // já autenticado em /login ou /signup: manda para o app em vez de reexibir o formulário.
  // Sem isto, quem volta ao site com sessão válida cai na tela de login e parece "travado
  // fora" da plataforma. Respeita o ?next= que este mesmo proxy adicionou no redirect.
  if (isAuthPage) {
    if (!valid) return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = safeNext(req.nextUrl.searchParams.get("next")) ?? "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
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
  // não intercepta assets, api, sdk.js, s/[id] (survey pública), r/[token] (relatório público), demo
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sdk.js|mascot|s/|r/|demo).*)"],
};
