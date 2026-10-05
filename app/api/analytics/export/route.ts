import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getCurrentProject } from "@/lib/auth/current";
import { getAnalytics, getAnalyticsSettings, listAnalyticsUsers, listViews, USER_SEGMENTS, USER_SORTS, type UserSegment, type UserSort } from "@/lib/db/analytics";
import { parseViewConfig, TAB_META } from "@/lib/analytics/core";
import { datasetsFor, TAB_LAYOUT } from "@/lib/analytics/derive";
import { analyticsTables, usersTable, type ExportTable } from "@/lib/analytics/export";
import { tablesToCsv } from "@/lib/export/csv";
import { tablesToXlsx } from "@/lib/export/xlsx";
import { tablesToPdf } from "@/lib/export/pdf";
import { normalizeHost } from "@/lib/hosts";
import { DEFAULT_PERIOD, periodLabel, periodToRange } from "@/lib/period";

export const dynamic = "force-dynamic";
// pdfkit/exceljs precisam do runtime Node
export const runtime = "nodejs";

const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "analytics";

/**
 * GET /api/analytics/export?format=csv|xlsx|pdf&<mesmos parâmetros da URL do Analytics>
 * Exporta a visão atual (aba ou visão salva, com período, plataforma e dispositivo) em tabelas.
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const project = await getCurrentProject();
  if (!project) return NextResponse.json({ error: "Nenhum projeto ativo." }, { status: 400 });

  const sp = new URL(req.url).searchParams;
  const format = (sp.get("format") || "csv").toLowerCase();
  if (!["csv", "xlsx", "pdf"].includes(format)) return NextResponse.json({ error: "Formato inválido. Use csv, xlsx ou pdf." }, { status: 400 });

  const projectId = project.id;
  const settings = await getAnalyticsSettings(projectId);
  const views = sp.get("view") ? await listViews(projectId, session.userId) : [];
  const saved = views.find((v) => v.id === sp.get("view")) ?? null;
  const w = sp.get("w");
  // mesma regra da página: a URL manda, a visão salva completa o que faltar
  const config = parseViewConfig({
    tab: sp.get("tab") ?? (w ? "custom" : saved?.config.tab),
    period: sp.get("period") ?? saved?.config.period,
    from: sp.get("from") ?? saved?.config.from,
    to: sp.get("to") ?? saved?.config.to,
    host: normalizeHost(sp.get("host")) || saved?.config.host,
    device: sp.get("device") ?? saved?.config.device,
    widgets: w ? w.split(",") : saved?.config.widgets,
    spans: w ? undefined : saved?.config.spans,
  });

  const period = config.period ?? DEFAULT_PERIOD;
  const range = periodToRange(period, config.from, config.to);
  const to = range.to ?? new Date();
  const from = range.from ?? new Date(to.getTime() - 365 * 86_400_000);
  const scope = { projectId, from, to, host: config.host, device: config.device };

  let tables: ExportTable[];
  if (config.tab === "users") {
    const seg = sp.get("seg") ?? "";
    const sort = sp.get("sort") ?? "";
    const list = await listAnalyticsUsers(scope, {
      q: sp.get("q") ?? undefined,
      segment: (USER_SEGMENTS as readonly string[]).includes(seg) ? (seg as UserSegment) : "all",
      sort: (USER_SORTS as readonly string[]).includes(sort) ? (sort as UserSort) : "recent",
      dir: sp.get("dir") === "asc" ? "asc" : "desc",
      pageSize: 10_000,
    });
    tables = [usersTable(list.rows)];
  } else {
    const widgets = config.tab === "custom" ? (config.widgets ?? []) : TAB_LAYOUT[config.tab].map((b) => b.id);
    const data = await getAnalytics(scope, settings, datasetsFor(widgets), { pagesLimit: 100, eventsLimit: 100 });
    tables = analyticsTables(data, widgets);
  }

  const name = saved?.name ?? `Analytics: ${TAB_META[config.tab].label}`;
  const subtitle = [project.name, periodLabel(period, config.from, config.to), config.host, config.device].filter(Boolean).join(" · ");
  const base = `luumu-${slugify(name)}-${new Date().toISOString().slice(0, 10)}`;

  if (format === "csv") return file(tablesToCsv(tables), `${base}.csv`, "text/csv; charset=utf-8");
  if (format === "xlsx") return file(await tablesToXlsx(tables, name), `${base}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  return file(await tablesToPdf(tables, { title: name, subtitle }), `${base}.pdf`, "application/pdf");
}

function file(buf: Buffer, filename: string, contentType: string) {
  return new NextResponse(new Uint8Array(buf), {
    headers: { "Content-Type": contentType, "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" },
  });
}
