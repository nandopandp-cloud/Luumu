"use server";

import { revalidatePath } from "next/cache";
import { canManageWorkspace, getCurrentProjectId, requireUser } from "@/lib/auth/current";
import { saveAccessibilitySettings } from "@/lib/db/accessibility";
import type { A11yConfig } from "@/lib/accessibility/config";

type Result = { ok: true; config: A11yConfig } | { ok: false; error: string };

/**
 * Salva o plugin de acessibilidade do projeto ativo (ligado/desligado + configuração).
 * Só owner/admin. O que chega do cliente passa por normalizeA11yConfig dentro de
 * saveAccessibilitySettings: valores desconhecidos caem no padrão, textos são cortados e a
 * lista de estudantes é limpa — a action devolve a versão gravada para a tela refletir isso.
 */
export async function saveAccessibilityAction(input: { enabled: boolean; config: unknown }): Promise<Result> {
  const session = await requireUser();
  if (!(await canManageWorkspace())) return { ok: false, error: "Só donos e administradores podem alterar o plugin de acessibilidade." };
  if (!input || typeof input.enabled !== "boolean") return { ok: false, error: "Dados inválidos." };
  // o JSON cru não pode ser gigante (a lista de estudantes tem teto próprio na normalização)
  if (JSON.stringify(input.config ?? {}).length > 400_000) return { ok: false, error: "Configuração grande demais. Reduza a lista de estudantes." };
  const projectId = await getCurrentProjectId();
  try {
    const config = await saveAccessibilitySettings(projectId, { enabled: input.enabled, config: input.config }, session.userId);
    revalidatePath("/accessibility");
    return { ok: true, config };
  } catch {
    return { ok: false, error: "Não foi possível salvar. A migração do plugin de acessibilidade (0044) já foi aplicada?" };
  }
}
