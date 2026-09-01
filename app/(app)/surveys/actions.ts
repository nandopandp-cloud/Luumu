"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createSurveyFromTemplate,
  updateSurvey,
  replaceQuestions,
  publishSurvey,
  setSurveyStatus,
  getSurveyWithQuestions,
  saveAppearance,
  deleteSurvey,
  enforceResponseLimit,
} from "@/lib/db/surveys";
import { submitResponse } from "@/lib/db/responses";
import { deriveSentiment } from "@/lib/sentiment";
import { normalizeAppearance } from "@/lib/builder";
import { getCurrentWorkspaceId, getCurrentProjectId } from "@/lib/auth/current";
import { getSurvey } from "@/lib/db/surveys";
import type { SurveyType, SurveyStatus } from "@/lib/mock/surveys";

/* ---------- Criar (a partir de template) ---------- */
export async function createSurveyAction(type: SurveyType) {
  const [workspaceId, projectId] = await Promise.all([getCurrentWorkspaceId(), getCurrentProjectId()]);
  const id = await createSurveyFromTemplate(workspaceId, projectId, type);
  revalidatePath("/surveys");
  redirect(`/surveys/${id}/builder`);
}

/* ---------- Salvar rascunho (builder) ---------- */
const questionSchema = z.object({
  uid: z.string().optional(), // uid temporário do builder (client), usado só para remapear logic.showIf
  blockId: z.string(),
  title: z.string(),
  required: z.boolean(),
  config: z.record(z.string(), z.unknown()).optional(),
  logic: z.record(z.string(), z.unknown()).optional(),
});

const saveDraftSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  type: z.string().min(1).optional(),
  questions: z.array(questionSchema),
});

export async function saveDraftAction(input: unknown) {
  const data = saveDraftSchema.parse(input);
  // escopo = projeto ativo (já filtrado pelo escopo do membro), não o workspace inteiro
  const scope = { projectId: await getCurrentProjectId() };
  await updateSurvey(data.id, scope, { name: data.name, ...(data.type ? { type: data.type } : {}) });
  await replaceQuestions(data.id, scope, data.questions);
  revalidatePath(`/surveys/${data.id}/builder`);
  revalidatePath("/surveys");
  revalidatePath("/dashboard");
  return { ok: true as const, savedAt: Date.now() };
}

/* ---------- Configurações de disparo (settings) ---------- */
const settingsSchema = z.object({
  id: z.string(),
  channel: z.string().optional(),
  audience: z.string().optional(),
  language: z.string().optional(),
  triggerEvents: z.array(z.string()).optional(),
  audienceMode: z.enum(["email", "id"]).nullable().optional(),
  audienceList: z.array(z.string()).optional(),
  frequency: z.string().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  responseLimit: z.number().int().positive().nullable().optional(),
});

export async function saveSettingsAction(input: unknown) {
  const { id, triggerEvents, ...rest } = settingsSchema.parse(input);
  const projectId = await getCurrentProjectId();
  // mantém o campo legado triggerEvent em sincronia (primeiro da lista, ou null)
  const patch = {
    ...rest,
    ...(triggerEvents !== undefined
      ? { triggerEvents, triggerEvent: triggerEvents[0] ?? null }
      : {}),
  };
  await updateSurvey(id, { projectId }, patch);
  revalidatePath(`/surveys/${id}/settings`);
  return { ok: true as const };
}

/* ---------- Publicar (valida nome + >=1 pergunta) ---------- */
export async function publishSurveyAction(id: string) {
  const projectId = await getCurrentProjectId();
  const data = await getSurveyWithQuestions(id, { projectId });
  if (!data) return { ok: false as const, error: "Pesquisa não encontrada." };
  if (!data.survey.name.trim()) return { ok: false as const, error: "Dê um nome à pesquisa antes de publicar." };
  if (data.questions.length === 0)
    return { ok: false as const, error: "Adicione ao menos uma pergunta antes de publicar." };

  await publishSurvey(id, { projectId });
  revalidatePath(`/surveys/${id}/builder`);
  revalidatePath("/surveys");
  revalidatePath("/dashboard");
  return { ok: true as const, url: `/s/${id}` };
}

/* ---------- Status (pausar / encerrar / reativar) ---------- */
export async function setStatusAction(id: string, status: SurveyStatus) {
  const projectId = await getCurrentProjectId();
  await setSurveyStatus(id, { projectId }, status);
  revalidatePath("/surveys");
  revalidatePath(`/surveys/${id}/builder`);
  return { ok: true as const };
}

/* ---------- Renomear ---------- */
const renameSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1, "O nome não pode ficar vazio.").max(120, "Nome muito longo."),
});

export async function renameSurveyAction(input: unknown) {
  const parsed = renameSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const projectId = await getCurrentProjectId();
  await updateSurvey(parsed.data.id, { projectId }, { name: parsed.data.name });
  revalidatePath("/surveys");
  revalidatePath(`/surveys/${parsed.data.id}/builder`);
  revalidatePath("/dashboard");
  return { ok: true as const };
}

/* ---------- Excluir ---------- */
export async function deleteSurveyAction(id: string) {
  const projectId = await getCurrentProjectId();
  await deleteSurvey(id, { projectId });
  revalidatePath("/surveys");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

/* ---------- Submeter resposta (página pública /s/[id]) ---------- */
const submitSchema = z.object({
  surveyId: z.string(),
  answers: z.array(z.object({ questionId: z.string(), value: z.unknown() })),
  score: z.number().nullable(),
  scoreBlockId: z.string().nullish(),
  scoreMin: z.number().nullish(),
  scoreMax: z.number().nullish(),
});

export async function submitResponseAction(input: unknown) {
  const data = submitSchema.parse(input);
  // caminho público (preview/link direto): só grava se a pesquisa existir e estiver ativa
  const survey = await getSurvey(data.surveyId);
  if (!survey || survey.status !== "ativa") {
    return { ok: false as const, error: "Pesquisa indisponível." };
  }
  await submitResponse({
    surveyId: data.surveyId,
    answers: data.answers as { questionId: string; value: unknown }[],
    score: data.score,
    sentiment: deriveSentiment(data.score, {
      blockId: data.scoreBlockId,
      min: data.scoreMin,
      max: data.scoreMax,
    }),
  });
  await enforceResponseLimit(data.surveyId);
  revalidatePath("/responses");
  revalidatePath(`/surveys/${data.surveyId}/responses`);
  revalidatePath("/dashboard");
  return { ok: true as const };
}

/* ---------- Aparência do widget (aba Exibição) ---------- */
export async function saveAppearanceAction(id: string, appearance: unknown) {
  const projectId = await getCurrentProjectId();
  const normalized = normalizeAppearance(appearance);
  await saveAppearance(id, { projectId }, normalized);
  revalidatePath(`/surveys/${id}/appearance`);
  return { ok: true as const, appearance: normalized };
}
