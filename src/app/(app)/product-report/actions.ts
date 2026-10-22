"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProductReportAccess } from "@/lib/product-report/access";
import { getVisibleProjects } from "@/lib/auth/current";
import { syncPeriod } from "@/lib/product-report/collect";
import { loadReportModel } from "@/lib/product-report/load";
import { parsePeriod } from "@/lib/product-report/period";
import { isGoalKey, METRICS, PLATFORM_KEYS } from "@/lib/product-report/indicators";
import type { ManualValue } from "@/lib/product-report/model";
import { insertRun, listStoredPeriods, saveProductReportSettings, saveStoredPeriod } from "@/lib/db/product-report";

/*
  Toda action começa pelo guard do módulo: chamar a action direto (sem passar pela página)
  continua exigindo a conta autorizada.
*/

type Result = { ok: true; id?: string } | { ok: false; error: string };

const PATH = "/product-report";
const period = z.string().refine((p) => parsePeriod(p) !== null, "Quinzena inválida.");
const value = z.number().finite().min(0, "Valores não podem ser negativos.").max(100_000).nullable();

/** Busca os indicadores da quinzena na Luumu e registra a execução (sucesso ou falha). */
export async function syncAction(input: unknown): Promise<Result> {
  const session = await requireProductReportAccess();
  const parsed = period.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Quinzena inválida." };
  const visible = await getVisibleProjects();
  const run = await syncPeriod({
    workspaceId: session.workspaceId,
    period: parsed.data,
    trigger: "manual",
    userId: session.userId,
    allowedProjectIds: visible.map((p) => p.id),
  });
  revalidatePath(PATH);
  if (run.status === "error") return { ok: false, error: `Não foi possível atualizar: ${run.error ?? "erro desconhecido"}.` };
  return { ok: true, id: run.id };
}

const goalsSchema = z.object({
  period,
  goals: z.record(z.string(), value).refine((g) => Object.keys(g).every(isGoalKey), "Indicador desconhecido."),
});

/** Metas de uma quinzena. null remove a meta (volta a herdar a anterior). */
export async function saveGoalsAction(input: unknown): Promise<Result> {
  const session = await requireProductReportAccess();
  const parsed = goalsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const current = (await listStoredPeriods(session.workspaceId)).find((p) => p.period === parsed.data.period);
  const goals = { ...(current?.goals ?? {}) } as Record<string, number>;
  for (const [k, v] of Object.entries(parsed.data.goals)) {
    if (v === null) delete goals[k];
    else goals[k] = v;
  }
  await saveStoredPeriod(session.workspaceId, session.userId, parsed.data.period, { goals });
  revalidatePath(PATH);
  return { ok: true };
}

const manualSchema = z.object({
  period,
  values: z.record(z.string(), value).refine((v) => Object.keys(v).every(isGoalKey), "Indicador desconhecido."),
});

/**
 * Ajustes manuais do realizado (plataforma, média consolidada "ns.*" ou "northstar"): valem
 * sobre o dado da Luumu. null desfaz o ajuste (volta ao automático; se havia valor da planilha,
 * ele é restaurado).
 */
export async function saveManualAction(input: unknown): Promise<Result> {
  const session = await requireProductReportAccess();
  const parsed = manualSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const current = (await listStoredPeriods(session.workspaceId)).find((p) => p.period === parsed.data.period);
  const manual = { ...(current?.manual ?? {}) } as Record<string, ManualValue>;
  for (const [k, v] of Object.entries(parsed.data.values)) {
    const prev = manual[k];
    // o valor original da planilha sobrevive ao ajuste, para poder voltar a ele
    const planilha = prev?.source === "planilha" ? prev.value : prev?.planilha;
    if (v === null) {
      if (typeof planilha === "number") manual[k] = { value: planilha, source: "planilha" };
      else delete manual[k];
    } else if (!(prev?.source === "planilha" && prev.value === v)) {
      manual[k] = { value: v, source: "manual", ...(typeof planilha === "number" ? { planilha } : {}) };
    }
  }
  await saveStoredPeriod(session.workspaceId, session.userId, parsed.data.period, { manual });
  revalidatePath(PATH);
  return { ok: true };
}

const textsSchema = z.object({
  period,
  intro: z.string().max(5_000, "Mensagem longa demais.").optional(),
  highlights: z
    .object({
      done: z.array(z.string().max(500, "Item longo demais.")).max(10, "No máximo 10 itens."),
      next: z.array(z.string().max(500, "Item longo demais.")).max(10, "No máximo 10 itens."),
    })
    .optional(),
  notes: z.string().max(20_000, "Texto longo demais.").optional(),
});

/** Mensagem de abertura, highlights e/ou observações executivas da quinzena. */
export async function saveTextsAction(input: unknown): Promise<Result> {
  const session = await requireProductReportAccess();
  const parsed = textsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const { period: p, highlights, ...texts } = parsed.data;
  // itens vazios não são guardados
  const clean = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean);
  await saveStoredPeriod(session.workspaceId, session.userId, p, {
    ...texts,
    ...(highlights ? { highlights: { done: clean(highlights.done), next: clean(highlights.next) } } : {}),
  });
  revalidatePath(PATH);
  return { ok: true };
}

const settingsSchema = z.object({
  platformProjects: z.record(z.enum(PLATFORM_KEYS as [string, ...string[]]), z.string().min(1).nullable()),
  weights: z.object(Object.fromEntries(METRICS.map((m) => [m, z.number().finite().min(0).max(100)])) as Record<(typeof METRICS)[number], z.ZodNumber>),
  autoSync: z.boolean(),
});

export async function saveSettingsAction(input: unknown): Promise<Result> {
  const session = await requireProductReportAccess();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  // só projetos que a conta enxerga (respeita o escopo de projetos do membro)
  const visible = new Set((await getVisibleProjects()).map((p) => p.id));
  const platformProjects: Record<string, string> = {};
  for (const [k, id] of Object.entries(parsed.data.platformProjects)) {
    if (!id) continue;
    if (!visible.has(id)) return { ok: false, error: "Projeto não encontrado." };
    platformProjects[k] = id;
  }
  await saveProductReportSettings(session.workspaceId, session.userId, { platformProjects, weights: parsed.data.weights, autoSync: parsed.data.autoSync });
  revalidatePath(PATH);
  return { ok: true };
}

/** Congela o relatório da quinzena (valores, metas e observações de agora) no histórico. */
export async function generateReportAction(input: unknown): Promise<Result> {
  const session = await requireProductReportAccess();
  const parsed = period.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Quinzena inválida." };
  const model = await loadReportModel(session.workspaceId, parsed.data);
  const run = await insertRun({
    workspaceId: session.workspaceId,
    period: parsed.data,
    kind: "report",
    status: model.northStar.value === null ? "partial" : "ok",
    trigger: "manual",
    data: { model },
    createdBy: session.userId,
  });
  revalidatePath(PATH);
  return { ok: true, id: run.id };
}
