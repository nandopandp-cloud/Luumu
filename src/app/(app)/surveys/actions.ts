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
  duplicateSurvey,
  enforceResponseLimit,
} from "@/lib/db/surveys";
import { submitResponse } from "@/lib/db/responses";
import { deriveSentiment } from "@/lib/surveys/sentiment";
import { normalizeAppearance, isMessageBlock, isPlaceholderMissing, type QuestionConfig } from "@/lib/surveys/builder";
import { isWithinSchedule, normalizeDate } from "@/lib/surveys/schedule";
import { normalizeHost } from "@/lib/platform/hosts";
import { normalizeSchoolYears } from "@/lib/surveys/school-years";
import { headers } from "next/headers";
import { detectDevice, isDeviceKind } from "@/lib/surveys/device";
import { getCurrentWorkspaceId, getCurrentProjectId, requireUser } from "@/lib/auth/current";
import { getSurvey } from "@/lib/db/surveys";
import type { SurveyType, SurveyStatus } from "@/lib/surveys/types";

/* ---------- Criar (a partir de template) ---------- */
export async function createSurveyAction(type: SurveyType) {
  const [workspaceId, projectId, user] = await Promise.all([
    getCurrentWorkspaceId(),
    getCurrentProjectId(),
    requireUser(),
  ]);
  const id = await createSurveyFromTemplate(workspaceId, projectId, type, user.userId);
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
  const ids = await replaceQuestions(data.id, scope, data.questions);
  revalidatePath(`/surveys/${data.id}/builder`);
  revalidatePath("/surveys");
  revalidatePath("/dashboard");
  return { ok: true as const, savedAt: Date.now(), ids };
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
  audienceSchoolYears: z.array(z.string()).max(20).optional(),
  targetHosts: z.array(z.string()).max(50).optional(),
  frequency: z.string().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  responseLimit: z.number().int().positive().nullable().optional(),
});

export async function saveSettingsAction(input: unknown) {
  const { id, triggerEvents, targetHosts, audienceSchoolYears, ...rest } = settingsSchema.parse(input);
  const from = normalizeDate(rest.startsAt);
  const to = normalizeDate(rest.endsAt);
  if (from && to && from > to) {
    return { ok: false as const, error: "A data de fim não pode ser anterior à de início." };
  }
  const projectId = await getCurrentProjectId();
  // mantém o campo legado triggerEvent em sincronia (primeiro da lista, ou null)
  const patch = {
    ...rest,
    ...(triggerEvents !== undefined
      ? { triggerEvents, triggerEvent: triggerEvents[0] ?? null }
      : {}),
    // plataformas-alvo normalizadas como o SDK as compara ([] = todas)
    ...(targetHosts !== undefined
      ? { targetHosts: Array.from(new Set(targetHosts.map(normalizeHost).filter(Boolean))) }
      : {}),
    // só códigos conhecidos, sem repetição ([] = todos os anos)
    ...(audienceSchoolYears !== undefined ? { audienceSchoolYears: normalizeSchoolYears(audienceSchoolYears) } : {}),
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
  // a saudação sozinha não é pesquisa: precisa de ao menos uma pergunta que peça resposta
  if (!data.questions.some((q) => !isMessageBlock(q.blockId)))
    return { ok: false as const, error: "Adicione ao menos uma pergunta antes de publicar." };
  const noPlaceholder = data.questions.findIndex((q) => isPlaceholderMissing(q.blockId, q.config as QuestionConfig));
  if (noPlaceholder !== -1)
    return {
      ok: false as const,
      error: `A pergunta ${noPlaceholder + 1} está com o placeholder ativado, mas sem texto. Escreva o texto ou desative a opção.`,
    };
  // publicar uma pesquisa já expirada geraria uma "ativa" que ninguém jamais veria
  if (data.survey.endsAt && !isWithinSchedule(null, data.survey.endsAt))
    return {
      ok: false as const,
      error: "A vigência desta pesquisa já terminou. Ajuste a data de fim em Configurações antes de publicar.",
    };

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

/* ---------- Duplicar (herda configurações + vigência da nova) ---------- */
const duplicateSchema = z
  .object({
    id: z.string(),
    name: z.string().trim().max(120, "Nome muito longo.").optional(),
    startsAt: z.string().optional(),
    endsAt: z.string().optional(),
  })
  .refine(
    (d) => {
      const from = normalizeDate(d.startsAt);
      const to = normalizeDate(d.endsAt);
      return !from || !to || from <= to;
    },
    { message: "A data de fim não pode ser anterior à de início." }
  );

export async function duplicateSurveyAction(input: unknown) {
  const parsed = duplicateSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  const [projectId, user] = await Promise.all([getCurrentProjectId(), requireUser()]);
  const newId = await duplicateSurvey(
    parsed.data.id,
    { projectId },
    {
      name: parsed.data.name,
      startsAt: normalizeDate(parsed.data.startsAt),
      endsAt: normalizeDate(parsed.data.endsAt),
    },
    user.userId
  );

  revalidatePath("/surveys");
  revalidatePath("/dashboard");
  return { ok: true as const, id: newId };
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
  device: z.string().max(20).nullish(),
});

export async function submitResponseAction(input: unknown) {
  const data = submitSchema.parse(input);
  // caminho público (preview/link direto): só grava se a pesquisa existir, estiver ativa
  // e dentro da vigência — senão bastaria manter a página aberta para responder depois do fim
  const survey = await getSurvey(data.surveyId);
  if (!survey || survey.status !== "ativa" || !isWithinSchedule(survey.startsAt, survey.endsAt)) {
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
    device: isDeviceKind(data.device) ? data.device : detectDevice((await headers()).get("user-agent")),
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
