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
} from "@/lib/db/surveys";
import { submitResponse } from "@/lib/db/responses";
import { deriveSentiment } from "@/lib/sentiment";
import { normalizeAppearance } from "@/lib/builder";
import { getCurrentWorkspaceId } from "@/lib/auth/current";
import { getSurvey } from "@/lib/db/surveys";
import type { SurveyType, SurveyStatus } from "@/lib/mock/surveys";

/* ---------- Criar (a partir de template) ---------- */
export async function createSurveyAction(type: SurveyType) {
  const workspaceId = await getCurrentWorkspaceId();
  const id = await createSurveyFromTemplate(workspaceId, type);
  revalidatePath("/surveys");
  redirect(`/surveys/${id}/builder`);
}

/* ---------- Salvar rascunho (builder) ---------- */
const questionSchema = z.object({
  blockId: z.string(),
  title: z.string(),
  required: z.boolean(),
  config: z.record(z.string(), z.unknown()).optional(),
  logic: z.record(z.string(), z.unknown()).optional(),
});

const saveDraftSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  questions: z.array(questionSchema),
});

export async function saveDraftAction(input: unknown) {
  const data = saveDraftSchema.parse(input);
  const workspaceId = await getCurrentWorkspaceId();
  await updateSurvey(data.id, workspaceId, { name: data.name });
  await replaceQuestions(data.id, workspaceId, data.questions);
  revalidatePath(`/surveys/${data.id}/builder`);
  revalidatePath("/surveys");
  return { ok: true as const, savedAt: Date.now() };
}

/* ---------- Configurações de disparo (settings) ---------- */
const settingsSchema = z.object({
  id: z.string(),
  channel: z.string().optional(),
  audience: z.string().optional(),
  segment: z.string().optional(),
  language: z.string().optional(),
  trigger: z.string().optional(),
  triggerEvent: z.string().nullable().optional(),
  frequency: z.string().optional(),
  delay: z.string().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
});

export async function saveSettingsAction(input: unknown) {
  const { id, ...patch } = settingsSchema.parse(input);
  const workspaceId = await getCurrentWorkspaceId();
  await updateSurvey(id, workspaceId, patch);
  revalidatePath(`/surveys/${id}/settings`);
  return { ok: true as const };
}

/* ---------- Publicar (valida nome + >=1 pergunta) ---------- */
export async function publishSurveyAction(id: string) {
  const workspaceId = await getCurrentWorkspaceId();
  const data = await getSurveyWithQuestions(id, workspaceId);
  if (!data) return { ok: false as const, error: "Pesquisa não encontrada." };
  if (!data.survey.name.trim()) return { ok: false as const, error: "Dê um nome à pesquisa antes de publicar." };
  if (data.questions.length === 0)
    return { ok: false as const, error: "Adicione ao menos uma pergunta antes de publicar." };

  await publishSurvey(id, workspaceId);
  revalidatePath(`/surveys/${id}/builder`);
  revalidatePath("/surveys");
  revalidatePath("/dashboard");
  return { ok: true as const, url: `/s/${id}` };
}

/* ---------- Status (pausar / encerrar / reativar) ---------- */
export async function setStatusAction(id: string, status: SurveyStatus) {
  const workspaceId = await getCurrentWorkspaceId();
  await setSurveyStatus(id, workspaceId, status);
  revalidatePath("/surveys");
  revalidatePath(`/surveys/${id}/builder`);
  return { ok: true as const };
}

/* ---------- Submeter resposta (página pública /s/[id]) ---------- */
const submitSchema = z.object({
  surveyId: z.string(),
  answers: z.array(z.object({ questionId: z.string(), value: z.unknown() })),
  score: z.number().nullable(),
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
    sentiment: deriveSentiment(data.score),
  });
  revalidatePath("/responses");
  revalidatePath(`/surveys/${data.surveyId}/responses`);
  revalidatePath("/dashboard");
  return { ok: true as const };
}

/* ---------- Aparência do widget (aba Exibição) ---------- */
export async function saveAppearanceAction(id: string, appearance: unknown) {
  const workspaceId = await getCurrentWorkspaceId();
  const normalized = normalizeAppearance(appearance);
  await saveAppearance(id, workspaceId, normalized);
  revalidatePath(`/surveys/${id}/appearance`);
  return { ok: true as const, appearance: normalized };
}
