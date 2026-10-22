import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LuumuLogo, Mascot } from "@/components/ui/Mascot";
import { PublicReportView } from "@/components/reports/PublicReportView";
import { getPublicReportByToken, incrementPublicReportViews } from "@/lib/db/reports";
import { getSurvey } from "@/lib/db/surveys";
import { buildReportSnapshot } from "@/lib/db/report-snapshot";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Relatório · Luumu", robots: { index: false } };
}

export default async function PublicReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const report = await getPublicReportByToken(token);
  if (!report) notFound();

  const survey = report.surveyId ? await getSurvey(report.surveyId, { projectId: report.projectId }) : null;

  const [snapshot] = await Promise.all([
    buildReportSnapshot({
      projectId: report.projectId,
      surveyId: report.surveyId,
      surveyName: survey?.name ?? null,
      period: report.period,
    }),
    // contagem de views best-effort — não bloqueia a renderização se falhar
    incrementPublicReportViews(report.id).catch(() => {}),
  ]);

  return (
    <div className="min-h-screen bg-bg px-4 py-10">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <LuumuLogo size={28} />
          <span className="rounded-full bg-surface-brand px-3 py-1 text-xs font-semibold text-accent">
            Relatório público
          </span>
        </div>

        <div className="mb-6">
          <h1 className="font-display text-3xl font-extrabold tracking-tight">{snapshot.scopeName}</h1>
          <p className="mt-1 text-sm text-fg-mut">{snapshot.periodLabel}</p>
        </div>

        {snapshot.total === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-line bg-bg-elev py-12 text-center">
            <Mascot name="Pensativo" size={120} float />
            <h2 className="mt-5 font-display text-xl font-extrabold">Ainda sem respostas</h2>
            <p className="mt-1.5 max-w-sm text-fg-mut">
              Este relatório será preenchido conforme as respostas chegarem.
            </p>
          </div>
        ) : (
          <PublicReportView snapshot={snapshot} />
        )}

        <p className="mt-8 text-center text-xs text-fg-mut">
          Feito com 💜 pela Luumu · Ouça. Entenda. Melhore.
        </p>
      </div>
    </div>
  );
}
