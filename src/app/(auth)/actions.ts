"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { INTRO_COOKIE } from "@/components/intro/cookie";
import { z } from "zod";
import { findUserByEmail, getUserWorkspace } from "@/lib/db/users";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/api/ratelimit";
import { safeNext } from "@/lib/auth/next";
import { isDbUnavailable } from "@/lib/db/unavailable";

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
}

const loginSchema = z.object({
  email: z.string().email("E-mail inválido."),
  password: z.string().min(1, "Informe a senha."),
});

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
    // primeira tela depois do login abre com a animação de entrada (lido pelo layout do app)
    (await cookies()).set(INTRO_COOKIE, "1", { path: "/", maxAge: 120, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
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

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
