"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { findUserByEmail, getUserWorkspace, createAccount } from "@/lib/db/users";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";

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

  const existing = await findUserByEmail(parsed.data.email);
  if (existing) return { error: "Já existe uma conta com este e-mail." };

  const { userId, workspaceId } = await createAccount(parsed.data);
  await createSession({ userId, workspaceId, email: parsed.data.email.toLowerCase(), name: parsed.data.name });
  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
