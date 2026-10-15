import { ProductReportView } from "@/components/product-report/ProductReportView";
import { requireProductReportAccess } from "@/lib/product-report/access";
import { getVisibleProjects } from "@/lib/auth/current";
import { getUserById } from "@/lib/db/users";
import { getProductReportSettings, listGeneratedReports } from "@/lib/db/product-report";
import { loadReportModel } from "@/lib/product-report/load";
import { reportStatus } from "@/lib/product-report/html";
import { lastClosedPeriod, parsePeriod, periodCode, periodDatesShort, periodLabel, periodOf, periodsUntil } from "@/lib/product-report/period";

export const dynamic = "force-dynamic";

/** Quinzenas no seletor: a em andamento e as 24 anteriores (um ano). */
const PICKER_SIZE = 25;

export default async function ProductReportPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const session = await requireProductReportAccess();
  const { period: raw } = await searchParams;
  // padrão: a última quinzena encerrada, que é a que o report cobre
  const period = parsePeriod(raw) ? raw! : lastClosedPeriod();

  const me = await getUserById(session.userId);
  const author = { name: me?.name ?? session.name, avatarUrl: me?.avatarUrl ?? null };
  const [model, settings, projects, reports] = await Promise.all([
    loadReportModel(session.workspaceId, period, { author }),
    getProductReportSettings(session.workspaceId),
    getVisibleProjects(),
    listGeneratedReports(session.workspaceId),
  ]);

  const current = periodOf(new Date());
  const options = periodsUntil(current, PICKER_SIZE).reverse();
  if (!options.includes(period)) options.push(period);

  return (
    <ProductReportView
      model={model}
      status={reportStatus(model.closed, reports.some((r) => r.period === period))}
      periodOptions={options.map((p) => ({ value: p, label: `${periodCode(p)} · ${periodDatesShort(p).replace(" a ", " - ")}${p === current ? " (em andamento)" : ""}` }))}
      settings={{ platformProjects: settings.platformProjects, weights: settings.weights, autoSync: settings.autoSync }}
      projects={projects.map((p) => ({ id: p.id, name: p.name }))}
      reports={reports.map((r) => ({ ...r, label: periodLabel(r.period) }))}
    />
  );
}
