"use server";

import { revalidatePath } from "next/cache";
import { canManageWorkspace, getCurrentProjectId, requireUser } from "@/lib/auth/current";
import { heatmapQuota, setHeatmapsEnabled } from "@/lib/db/heatmaps";

/** Liga/desliga a coleta de heatmaps no projeto ativo. Só owner/admin. */
export async function setHeatmapsEnabledAction(enabled: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireUser();
  if (!(await canManageWorkspace())) return { ok: false, error: "Só donos e administradores podem mudar a coleta." };
  const projectId = await getCurrentProjectId();
  if (enabled && !(await heatmapQuota(session.workspaceId, true)).allowed) {
    return { ok: false, error: "Heatmaps estão disponíveis a partir do plano Starter." };
  }
  try {
    await setHeatmapsEnabled(projectId, enabled, session.userId);
  } catch {
    return { ok: false, error: "Não foi possível salvar. A migração dos heatmaps (0019) já foi aplicada?" };
  }
  revalidatePath("/heatmaps");
  return { ok: true };
}
