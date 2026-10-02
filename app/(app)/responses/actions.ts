"use server";

import { getCurrentProjectId } from "@/lib/auth/current";
import { getResponseDetail } from "@/lib/db/response-feed";

/** Detalhe de uma resposta (todas as perguntas). Só do projeto ativo. */
export async function getResponseDetailAction(id: string) {
  const projectId = await getCurrentProjectId();
  const d = await getResponseDetail(id, projectId);
  return d ? { ...d, createdAt: d.createdAt.toISOString() } : null;
}
