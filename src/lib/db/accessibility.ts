import "server-only";
import { eq } from "drizzle-orm";
import { db } from "./client";
import { accessibilitySettings } from "@/lib/db/schema";
import { normalizeA11yConfig, publicA11yConfig, type A11yConfig, type PublicA11yConfig } from "@/lib/accessibility/config";

/*
  Plugin de Acessibilidade no banco: uma linha por projeto (ver schema.ts). O /config consulta
  em TODA carga do SDK, por isso o cache de 60s por instância (mesma regra dos heatmaps): ligar,
  desligar ou editar leva até 1 minuto para chegar aos sites — o mesmo atraso do cache de borda
  do /config.
*/

export interface AccessibilitySettings {
  enabled: boolean;
  config: A11yConfig;
  updatedAt: Date | null;
}

const cache = new Map<string, { v: AccessibilitySettings; exp: number }>();
const TTL_MS = 60_000;

/** Lê a configuração (normalizada). Sem linha = desligado com a configuração padrão. */
export async function getAccessibilitySettings(projectId: string): Promise<AccessibilitySettings> {
  const hit = cache.get(projectId);
  if (hit && hit.exp > Date.now()) return hit.v;
  const [row] = await db
    .select({ enabled: accessibilitySettings.enabled, config: accessibilitySettings.config, updatedAt: accessibilitySettings.updatedAt })
    .from(accessibilitySettings)
    .where(eq(accessibilitySettings.projectId, projectId))
    .limit(1);
  const v: AccessibilitySettings = {
    enabled: !!row?.enabled,
    config: normalizeA11yConfig(row?.config ?? {}),
    updatedAt: row?.updatedAt ?? null,
  };
  cache.set(projectId, { v, exp: Date.now() + TTL_MS });
  return v;
}

/** O que vai no /config: o recorte público, ou null com o plugin desligado. */
export async function getAccessibilityForSdk(projectId: string): Promise<PublicA11yConfig | null> {
  const s = await getAccessibilitySettings(projectId);
  return s.enabled ? publicA11yConfig(s.config) : null;
}

export async function saveAccessibilitySettings(projectId: string, input: { enabled: boolean; config: unknown }, userId: string) {
  const config = normalizeA11yConfig(input.config);
  await db
    .insert(accessibilitySettings)
    .values({ projectId, enabled: input.enabled, config, updatedBy: userId })
    .onConflictDoUpdate({
      target: accessibilitySettings.projectId,
      set: { enabled: input.enabled, config, updatedBy: userId, updatedAt: new Date() },
    });
  cache.delete(projectId);
  return config;
}

export async function setAccessibilityEnabled(projectId: string, enabled: boolean, userId: string) {
  const current = await getAccessibilitySettings(projectId);
  await saveAccessibilitySettings(projectId, { enabled, config: current.config }, userId);
}
