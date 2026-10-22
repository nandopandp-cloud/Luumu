"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/current";
import { getUserById, updateUserPassword, updateUserAvatar } from "@/lib/db/users";
import { verifyPassword } from "@/lib/auth/password";

export type ProfileResult = { ok: boolean; error?: string };

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual."),
    newPassword: z.string().min(6, "A nova senha precisa ter ao menos 6 caracteres.").max(200),
    confirmPassword: z.string().min(1, "Confirme a nova senha."),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "A confirmação não coincide com a nova senha.",
    path: ["confirmPassword"],
  });

/**
 * Troca a senha do próprio usuário.
 *
 * Exige a senha atual mesmo já havendo sessão: o cookie sozinho não deve bastar para
 * trocar a credencial, senão uma sessão sequestrada (ou uma máquina deixada aberta)
 * viraria takeover permanente da conta. Só o dono da senha atual troca a senha.
 */
export async function changePasswordAction(input: unknown): Promise<ProfileResult> {
  const { userId } = await requireUser();

  const parsed = passwordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const user = await getUserById(userId);
  if (!user) return { ok: false, error: "Usuário não encontrado." };

  if (!(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
    return { ok: false, error: "Senha atual incorreta." };
  }
  if (await verifyPassword(parsed.data.newPassword, user.passwordHash)) {
    return { ok: false, error: "A nova senha precisa ser diferente da atual." };
  }

  await updateUserPassword(userId, parsed.data.newPassword);
  return { ok: true };
}

/**
 * Remove a foto de perfil, voltando à inicial do nome.
 * O upload em si é feito pela rota /api/settings/avatar (multipart).
 */
export async function removeAvatarAction(): Promise<ProfileResult> {
  const { userId } = await requireUser();
  await updateUserAvatar(userId, null);
  revalidatePath("/settings/profile");
  revalidatePath("/", "layout");
  return { ok: true };
}
