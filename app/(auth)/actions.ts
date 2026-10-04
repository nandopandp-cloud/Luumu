"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { findUserByEmail, getUserWorkspace } from "@/lib/db/users";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/api/ratelimit";

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
}

const loginSchema = z.object({
  email: z.string().email("E-mail inválido."),
  password: z.string().min(1, "Informe a senha."),
});

/**
 * Rotas protegidas às quais o login pode devolver o usuário (espelha PROTECTED do proxy.ts).
 * As áreas de LOCKED_ROUTES ficam de fora: o proxy as devolveria para /dashboard.
 */
const NEXT_ALLOWED = [
  "/dashboard", "/surveys", "/responses", "/reports", "/sdk", "/settings", "/tours", "/insights", "/billing", "/heatmaps", "/help",
];

/**
 * Destino pós-login: só caminho interno de rota protegida. `next` vem da URL (entrada do
 * usuário), então "//evil.com" e URLs absolutas são descartadas para não virar open redirect.
 */
function safeNext(raw: FormDataEntryValue | null): string {
  const next = typeof raw === "string" ? raw : "";
  if (!next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return NEXT_ALLOWED.some((p) => next === p || next.startsWith(p + "/")) ? next : "/dashboard";
}

export type AuthResult = { error?: string };

export async function loginAction(_prev: AuthResult, formData: FormData): Promise<AuthResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // trava por e-mail tentado (independe de IP) + por IP (evita varrer vários e-mails)
  const ip = await clientIp();
  const emailKey = parsed.data.email.toLowerCase();
  const [byEmail, byIp] = await Promise.all([
    checkRateLimit(`login:email:${emailKey}`, 8, 60),
    checkRateLimit(`login:ip:${ip}`, 20, 60),
  ]);
  if (!byEmail || !byIp) {
    return { error: "Muitas tentativas. Aguarde um minuto e tente novamente." };
  }

  // O banco pode estar indisponível (ex.: quota do Neon estourada, HTTP 402). Sem este
  // catch a exceção sobe até o error boundary e o usuário vê "Algo não saiu como esperado"
  // sem saber que o problema é infraestrutura, não a senha dele. `redirect()` fica FORA do
  // try porque funciona lançando — capturá-lo aqui viraria "erro ao entrar" num login que deu certo.
  let user: Awaited<ReturnType<typeof findUserByEmail>>;
  let ws: Awaited<ReturnType<typeof getUserWorkspace>>;
  try {
    user = await findUserByEmail(parsed.data.email);
    if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
      return { error: "E-mail ou senha incorretos." };
    }
    ws = await getUserWorkspace(user.id);
    if (!ws) return { error: "Usuário sem workspace. Contate o suporte." };

    await createSession({ userId: user.id, workspaceId: ws.workspaceId, email: user.email, name: user.name });
  } catch (err) {
    if (isDbUnavailable(err)) {
      console.error("[login] banco indisponível", err);
      return { error: "Serviço temporariamente indisponível. Tente novamente em alguns minutos." };
    }
    throw err;
  }
  // devolve o usuário à página que ele tentou abrir antes do login (o proxy a guarda em ?next=)
  redirect(safeNext(formData.get("next")));
}

/**
 * Falha de infraestrutura do banco (indisponível), não erro de credencial.
 * Cobre a quota do Neon (HTTP 402 / 429), indisponibilidade do serviço (5xx) e falha de
 * rede do driver neon-http (`fetch failed`). Percorre a cadeia de `cause` porque o Drizzle
 * embrulha o NeonDbError original dentro do seu próprio erro de query.
 */
function isDbUnavailable(err: unknown): boolean {
  for (let e: unknown = err, depth = 0; e && depth < 5; depth++) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/HTTP status (402|429|5\d\d)|exceeded the data transfer quota|fetch failed|Failed query/i.test(msg)) {
      return true;
    }
    e = e instanceof Error ? (e as { cause?: unknown }).cause : undefined;
  }
  return false;
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
