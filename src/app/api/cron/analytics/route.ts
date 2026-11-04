import { NextResponse } from "next/server";
import { runAnalyticsCron } from "@/lib/db/analytics-panel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * GET /api/cron/analytics — madrugada (Vercel Cron, 1x/dia): refaz o resumo diário dos últimos
 * dias (analytics_session_days) e recalcula os resultados prontos do painel (analytics_results).
 * Protegido pelo CRON_SECRET, como /api/cron/reports.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  return NextResponse.json(await runAnalyticsCron());
}
