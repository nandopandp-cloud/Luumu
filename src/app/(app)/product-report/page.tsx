import { ProductReportView } from "@/components/product-report/ProductReportView";
import { requireProductReportAccess } from "@/lib/product-report/access";
import { getVisibleProjects } from "@/lib/auth/current";
import { getProductReportSettings, listGeneratedReports } from "@/lib/db/product-report";
import { isProductReportSchemaMissing, loadReportModel } from "@/lib/product-report/load";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
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

  let data;
  try {
    data = await Promise.all([
      loadReportModel(session.workspaceId, period),
      getProductReportSettings(session.workspaceId),
      getVisibleProjects(),
      listGeneratedReports(session.workspaceId),
    ]);
  } catch (err) {
    // banco sem as tabelas/colunas do módulo: diz o que aplicar em vez do erro genérico
    if (!isProductReportSchemaMissing(err)) throw err;
    console.error("[product-report] migrações pendentes:", err instanceof Error ? err.message.slice(0, 200) : err);
    return (
      <div className="flex flex-col gap-4">
        <PageHeader eyebrow="Inteligência" title="Report Quinzenal de Produto" />
        <EmptyState
          title="Falta atualizar o banco de dados"
          description="As tabelas do Report Quinzenal ainda não existem (ou estão incompletas) no banco. Aplique as migrações drizzle/0032_product_report.sql, 0033_product_report_history.sql, 0034_product_report_intro.sql e 0035_product_report_highlights.sql e recarregue a página."
        />
      </div>
    );
  }
  const [model, settings, projects, reports] = data;

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
