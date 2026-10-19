"use server";

import { z } from "zod";
import { getCurrentProjectId, getCurrentRole, requireUser } from "@/lib/auth/current";
import { getResponseDetail, setResponsesExcluded } from "@/lib/db/response-feed";

/** Detalhe de uma resposta (todas as perguntas). Só do projeto ativo. */
export async function getResponseDetailAction(id: string) {
  const projectId = await getCurrentProjectId();
  const d = await getResponseDetail(id, projectId);
  return d ? { ...d, createdAt: d.createdAt.toISOString(), excludedAt: d.excludedAt?.toISOString() ?? null } : null;
}

const excludeSchema = z.object({
  ids: z.array(z.string().min(1).max(64)).min(1).max(300),
  excluded: z.boolean(),
});

/**
 * Desconsidera respostas (spam, teste) ou volta a considerá-las. A resposta continua guardada;
 * só sai dos cálculos. As telas são force-dynamic: o router.refresh() do cliente já recalcula.
 */
export async function setResponsesExcludedAction(input: unknown) {
  const parsed = excludeSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Seleção inválida." };
  const [session, projectId, role] = await Promise.all([requireUser(), getCurrentProjectId(), getCurrentRole()]);
  if (role === "viewer") return { ok: false as const, error: "Seu papel no workspace é somente leitura." };
  const changed = await setResponsesExcluded(parsed.data.ids, projectId, parsed.data.excluded, session.userId);
  return { ok: true as const, changed };
}
