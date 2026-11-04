/**
 * Confere o resumo diário do Analytics (migração 0041): calcula os blocos que leem o resumo duas
 * vezes, pelo resumo e pelas telas (ANALYTICS_ROLLUPS=off), e mostra o que diferir. O período
 * termina ontem às 19h para não pegar dado chegando ao vivo.
 *
 *   pnpm exec tsx --tsconfig scripts/tsconfig.scripts.json scripts/check-analytics-rollups.ts [projectId] [dias=7]
 */
import "./support/env";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { getAnalytics, getAnalyticsSettings, listAnalyticsUsers, type AnalyticsScope } from "@/lib/db/analytics";
import { addDays, brDay, dayStart } from "@/lib/analytics/rollup-range";

async function main() {
  const projectId =
    process.argv[2] ??
    ((await db.execute(sql`select project_id from analytics_sessions where started_at > now() - interval '7 days' group by 1 order by count(*) desc limit 1`)) as unknown as { rows: { project_id: string }[] }).rows[0]?.project_id;
  if (!projectId) return console.log("Nenhum projeto com dados.");
  const days = Number(process.argv[3]) || 7;
  const to = new Date(dayStart(addDays(brDay(new Date()), 0)).getTime() - 5 * 3_600_000);
  const s: AnalyticsScope = { projectId, from: new Date(to.getTime() - days * 86_400_000), to };
  const st = await getAnalyticsSettings(projectId, true);
  const want = new Set(["pages", "events", "eventTrend", "configured", "funnel"] as const);

  const run = async (mode: "on" | "off") => {
    process.env.ANALYTICS_ROLLUPS = mode;
    const t = performance.now();
    const data = await getAnalytics(s, st, new Set(want), { pagesLimit: 10, eventsLimit: 10 });
    const users = await listAnalyticsUsers(s, {});
    return { data: { ...data, userEvents: users.rows.map((r) => [r.anonId, r.events]) }, ms: Math.round(performance.now() - t) };
  };
  const off = await run("off");
  const on = await run("on");
  console.log(`${projectId}, ${days} dias até ${to.toISOString()}: telas ${off.ms} ms, resumo ${on.ms} ms`);
  let bad = 0;
  for (const k of [...want, "userEvents"] as const) {
    const a = JSON.stringify((off.data as Record<string, unknown>)[k]);
    const b = JSON.stringify((on.data as Record<string, unknown>)[k]);
    if (a !== b) bad++;
    console.log(`${k.padEnd(12)} ${a === b ? "igual" : "DIFERENTE"}`);
    if (a !== b) console.log(`  telas:  ${a.slice(0, 300)}\n  resumo: ${b.slice(0, 300)}`);
  }
  if (bad) process.exitCode = 1;
}

main().then(
  () => process.exit(process.exitCode ?? 0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
