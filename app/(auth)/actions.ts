"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { findUserByEmail, getUserWorkspace, createAccount } from "@/lib/db/users";
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

const signupSchema = z.object({
  name: z.string().min(2, "Informe seu nome."),
  email: z.string().email("E-mail inválido."),
  password: z.string().min(6, "A senha precisa ter ao menos 6 caracteres."),
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

  const user = await findUserByEmail(parsed.data.email);
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: "E-mail ou senha incorretos." };
  }
  const ws = await getUserWorkspace(user.id);
  if (!ws) return { error: "Usuário sem workspace. Contate o suporte." };

  await createSession({ userId: user.id, workspaceId: ws.workspaceId, email: user.email, name: user.name });
  redirect("/dashboard");
}

export async function signupAction(_prev: AuthResult, formData: FormData): Promise<AuthResult> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // limita criação de contas por IP (evita spam automatizado)
  const ip = await clientIp();
  const ok = await checkRateLimit(`signup:ip:${ip}`, 5, 3600);
  if (!ok) return { error: "Muitas contas criadas recentemente. Tente novamente mais tarde." };

  const existing = await findUserByEmail(parsed.data.email);
  if (existing) return { error: "Já existe uma conta com este e-mail." };

  let account: { userId: string; workspaceId: string };
  try {
    account = await createAccount(parsed.data);
  } catch (err) {
    // dois cadastros simultâneos com o mesmo e-mail: a checagem acima não pega,
    // mas a constraint única do banco (users.email) rejeita o segundo insert.
    if (isUniqueViolation(err)) return { error: "Já existe uma conta com este e-mail." };
    throw err;
  }

  await createSession({ userId: account.userId, workspaceId: account.workspaceId, email: parsed.data.email.toLowerCase(), name: parsed.data.name });
  redirect("/dashboard");
}

function isUniqueViolation(err: unknown): boolean {
  // driver do Postgres (neon-http/pg) expõe o SQLSTATE em err.code; 23505 = unique_violation
  return typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === "23505";
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
