import "server-only";
import { sql } from "drizzle-orm";
import { db } from "./client";

/*
  Armazém dos resultados do painel de Analytics (analytics_results, migração 0042): leitura,
  gravação e a "trava" de recálculo. A regra de quando recalcular fica em analytics-panel.ts.
*/

const rows = <T,>(r: unknown) => ((r as { rows?: T[] }).rows ?? (r as T[])) as T[];
const list = (xs: string[]) => sql.join(xs.map((x) => sql`${x}`), sql`, `);

export interface StoredResult {
  value: unknown;
  /** quando foi calculado (ms) */
  at: number;
}

let missingWarned = false;

/** Resultados guardados das chaves pedidas. null = tabela ausente (migração 0042 não aplicada). */
export async function readResults(projectId: string, keys: string[]): Promise<Map<string, StoredResult> | null> {
  if (!keys.length) return new Map();
  try {
    const r = rows<{ key: string; value: unknown; at: string | number }>(
      await db.execute(sql`
        select key, value, (extract(epoch from computed_at) * 1000)::bigint at
          from analytics_results where project_id = ${projectId} and key in (${list(keys)})`)
    );
    return new Map(r.map((x) => [x.key, { value: x.value, at: Number(x.at) }]));
  } catch (e) {
    const why = (e as { cause?: { message?: string } })?.cause?.message ?? String(e);
    if (!missingWarned) console.warn(`[analytics] resultados prontos indisponíveis (migração 0042?), calculando na hora: ${why}`);
    missingWarned = true;
    return null;
  }
}

/** Guarda (ou troca) um resultado e libera a trava de recálculo. */
export async function writeResult(projectId: string, key: string, value: unknown) {
  await db.execute(sql`
    insert into analytics_results (project_id, key, value, computed_at, accessed_at)
    values (${projectId}, ${key}, ${JSON.stringify(value)}::jsonb, now(), now())
    on conflict (project_id, key) do update set value = excluded.value, computed_at = excluded.computed_at, refreshing_at = null`);
}

/**
 * Trava o recálculo das chaves para esta instância: devolve só as que ninguém está recalculando
 * (ou cuja trava passou de 5 min). Evita que várias abas abertas refaçam a mesma consulta.
 */
export async function claimRefresh(projectId: string, keys: string[]): Promise<Set<string>> {
  if (!keys.length) return new Set();
  const r = rows<{ key: string }>(
    await db.execute(sql`
      update analytics_results set refreshing_at = now()
       where project_id = ${projectId} and key in (${list(keys)})
         and (refreshing_at is null or refreshing_at < now() - interval '5 minutes')
      returning key`)
  );
  return new Set(r.map((x) => x.key));
}

/** Marca as chaves como abertas agora (no máximo uma escrita por hora por chave). */
export async function touchResults(projectId: string, keys: string[]) {
  if (!keys.length) return;
  await db.execute(sql`
    update analytics_results set accessed_at = now()
     where project_id = ${projectId} and key in (${list(keys)}) and accessed_at < now() - interval '1 hour'`);
}

/** Chaves abertas nos últimos `days` dias (o que o cron mantém aquecido). */
export async function recentResultKeys(days: number): Promise<{ projectId: string; key: string; at: number }[]> {
  const r = rows<{ project_id: string; key: string; at: string | number }>(
    await db.execute(sql`
      select project_id, key, (extract(epoch from computed_at) * 1000)::bigint at from analytics_results
       where accessed_at > now() - make_interval(days => ${days}) order by accessed_at desc`)
  );
  return r.map((x) => ({ projectId: x.project_id, key: x.key, at: Number(x.at) }));
}

/** Apaga o que ninguém abre há `days` dias. */
export async function pruneResults(days: number) {
  const r = (await db.execute(sql`delete from analytics_results where accessed_at < now() - make_interval(days => ${days})`)) as unknown as {
    rowCount?: number;
  };
  return r.rowCount ?? 0;
}
