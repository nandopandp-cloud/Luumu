/**
 * Preenche o resumo diário do Analytics (analytics_session_days, migração 0041) com o histórico:
 * do primeiro dia com telas até ontem, um dia por vez (cada dia numa transação). Pula os dias já
 * marcados como prontos, então dá para interromper e rodar de novo. Depois disso o cron diário
 * mantém os últimos dias em dia.
 *
 *   pnpm exec tsx --tsconfig scripts/tsconfig.scripts.json scripts/backfill-analytics-rollups.ts          # só os dias que faltam
 *   pnpm exec tsx --tsconfig scripts/tsconfig.scripts.json scripts/backfill-analytics-rollups.ts --redo   # refaz todos
 */
import "./support/env";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { rollupDay } from "@/lib/db/analytics-rollup";
import { addDays, brDay } from "@/lib/analytics/rollup-range";

const REDO = process.argv.includes("--redo");

async function main() {
  const [first] = (
    (await db.execute(sql`select ${sql.raw(`to_char((min(created_at) at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD')`)} d from analytics_pageviews`)) as unknown as {
      rows: { d: string | null }[];
    }
  ).rows;
  if (!first?.d) return console.log("Nenhuma tela gravada: nada a resumir.");
  const done = new Set(
    ((await db.execute(sql`select to_char(day, 'YYYY-MM-DD') d from analytics_rollup_days`)) as unknown as { rows: { d: string }[] }).rows.map((x) => x.d)
  );
  const yesterday = addDays(brDay(new Date()), -1);
  let n = 0;
  for (let d = first.d; d <= yesterday; d = addDays(d, 1)) {
    if (!REDO && done.has(d)) continue;
    const t = performance.now();
    await rollupDay(d);
    n++;
    console.log(`${d}  ${Math.round(performance.now() - t)} ms`);
  }
  console.log(`${n} dia(s) resumido(s), de ${first.d} a ${yesterday}.`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
