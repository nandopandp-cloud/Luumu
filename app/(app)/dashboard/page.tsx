import Link from "next/link";
import { CalendarDays, MessagesSquare, Plus, Smile, Timer } from "lucide-react";
import { DataFilters } from "@/components/ui/DataFilters";
import { InsightCard, pctDelta, scoreDelta } from "@/components/ui/InsightCard";
import { ScoreEvolutionCard } from "@/components/dashboard/ScoreEvolutionCard";
import { DistributionBars } from "@/components/dashboard/DistributionBars";
import { RecentSurveys, type RecentSurvey } from "@/components/dashboard/RecentSurveys";
import { TemplatesTip } from "@/components/dashboard/TemplatesTip";
import { listSurveys, listSurveyOptions, resolveSurveyScope } from "@/lib/db/surveys";
import { getScoreDistribution } from "@/lib/db/responses";
import { getOverview, getScoreSeries, previousScope } from "@/lib/db/overview";
import { listHosts } from "@/lib/db/hosts";
import { requireUser, getCurrentProjectId } from "@/lib/auth/current";
import { formatScore } from "@/lib/scoring";
import { normalizeHost } from "@/lib/hosts";
import { formatDayBR, periodToRange } from "@/lib/period";

export const dynamic = "force-dynamic";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const shortDate = (d: Date) => `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
// "2026-09-28" → "28/09/26"
const ymdShort = (s: string | null) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(2, 4)}` : "");

type SurveyRow = Awaited<ReturnType<typeof listSurveys>>[number];

/** A pesquisa esteve no ar em algum momento da janela [from, to]? (publicada e com vigência sobreposta) */
function liveDuring(s: SurveyRow, from: Date, to: Date): boolean {
  if (s.status === "rascunho" || !s.publishedAt || s.publishedAt > to) return false;
  const fromKey = from.toISOString().slice(0, 10);
  const toKey = to.toISOString().slice(0, 10);
  if (s.endsAt && s.endsAt < fromKey) return false;
  if (s.startsAt && s.startsAt > toKey) return false;
  return true;
}

const DASHBOARD_DEFAULT_PERIOD = "all";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ surveyId?: string; period?: string; from?: string; to?: string; host?: string }>;
}) {
  const { name } = await requireUser();
  const { surveyId, period: periodParam, from, to, host: hostParam } = await searchParams;
  // o Dashboard abre com TODO o histórico; um período específico é escolha do usuário
  const period = periodParam ?? DASHBOARD_DEFAULT_PERIOD;
  const projectId = await getCurrentProjectId();
  const host = normalizeHost(hostParam) || undefined;
  const { from: dateFrom, to: dateTo } = periodToRange(period, from, to);
  // sem filtro na URL, abre já na última pesquisa vigente/criada (da plataforma, se filtrada)
  const { surveyId: scopedSurveyId, defaultSurveyId } = await resolveSurveyScope(projectId, surveyId, host);
  const scope = { projectId, surveyId: scopedSurveyId, dateFrom, dateTo, host };

  const [projectSurveys, surveyOptions, overview, distribution, hosts] = await Promise.all([
    listSurveys(projectId),
    listSurveyOptions(projectId, host),
    getOverview(scope),
    getScoreDistribution(scope),
    listHosts(projectId),
  ]);
  const series = await getScoreSeries(scope, overview.mainScore);
  const { counts, prevCounts, mainScore, prevScore, positivePct, prevPositivePct, daily } = overview;

  // com plataforma filtrada, contagem de ativas e lista recente também são só dela
  const allSurveys = host ? projectSurveys.filter((s) => ((s.targetHosts as string[]) ?? []).includes(host)) : projectSurveys;
  const activeCount = allSurveys.filter((s) => s.status === "ativa").length;
  const prev = previousScope(scope);
  const prevActive = prev ? allSurveys.filter((s) => liveDuring(s, prev.dateFrom!, prev.dateTo ?? new Date())).length : null;

  const rangeEnd = dateTo ?? new Date();
  const rangeText = dateFrom ? `${formatDayBR(dateFrom)} - ${formatDayBR(rangeEnd)}` : "Todo o período";
  const firstName = name.split(" ")[0];
  const scoreName = mainScore?.label ?? "Nota";
  const isPct = mainScore ? mainScore.methodology !== "nps" && mainScore.methodology !== "ces" : true;

  const recent: RecentSurvey[] = allSurveys.slice(0, 5).map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    status: s.status,
    range: s.startsAt || s.endsAt ? `${ymdShort(s.startsAt) || "…"} a ${ymdShort(s.endsAt) || "sem fim"}` : "",
    responses: s.responseCount,
    score: s.score != null ? s.scoreLabel : "—",
    createdAt: shortDate(s.createdAt),
  }));

  return (
    <div className="flex flex-col gap-4">
      {/* Cabeçalho */}
      <div className="mb-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <span className="mb-2 inline-flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            <span className="h-0.5 w-5 rounded-full [background:var(--grad-marca)]" />
            Visão geral
          </span>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Olá, {firstName} 👋</h1>
          <p className="mt-1.5 text-sm text-fg-mut">Acompanhe o que está acontecendo com suas pesquisas e a voz dos seus clientes.</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-bg-elev px-3.5 py-2.5 text-sm font-semibold text-fg-soft" title="Período dos dados (altere no filtro abaixo)">
            <CalendarDays className="size-4 text-fg-mut" />
            {rangeText}
          </span>
          <Link
            href="/surveys/new"
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-glow)] transition hover:-translate-y-0.5 [background:var(--grad-roxo)]"
          >
            <Plus className="size-4" /> Nova pesquisa
          </Link>
        </div>
      </div>

      <DataFilters surveys={surveyOptions} defaultSurveyId={defaultSurveyId} hosts={hosts} defaultPeriod={DASHBOARD_DEFAULT_PERIOD} />

      {/* Métricas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InsightCard
          label={scoreName}
          value={mainScore ? formatScore(mainScore) : "—"}
          tone="roxo"
          icon={<Smile className="size-5" />}
          series={series.day.slice(-daily.length).map((p) => p.score ?? 0)}
          delta={scoreDelta(mainScore, prevScore)}
          hint={mainScore?.formula}
        />
        <InsightCard
          label="Sentimento positivo"
          value={`${positivePct}%`}
          tone="verde"
          icon={<Smile className="size-5" />}
          series={daily.map((d) => (d.total ? (d.positive / d.total) * 100 : 0))}
          delta={prevPositivePct != null ? { value: positivePct - prevPositivePct, unit: "p.p." } : null}
        />
        <InsightCard
          label="Total de respostas"
          value={counts.all.toLocaleString("pt-BR")}
          tone="azul"
          icon={<MessagesSquare className="size-5" />}
          chart="bars"
          series={daily.map((d) => d.total)}
          delta={pctDelta(counts.all, prevCounts?.all)}
        />
        <InsightCard
          label="Pesquisas ativas"
          value={String(activeCount)}
          tone="laranja"
          icon={<Timer className="size-5" />}
          series={daily.map(() => activeCount)}
          // sem pesquisa no ar antes, variação % não faz sentido; 0 → 0 é "estável"
          delta={prevActive ? pctDelta(activeCount, prevActive) : prevActive === 0 && activeCount === 0 ? { value: 0, unit: "%" } : null}
        />
      </div>

      {/* Evolução + distribuição */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <ScoreEvolutionCard
          series={series}
          scoreLabel={scoreName}
          scoreSuffix={isPct ? "%" : ""}
          scoreRange={mainScore?.range ?? { min: 0, max: 100 }}
        />
        <DistributionBars buckets={distribution.map((b) => ({ label: b.label, value: b.value }))} total={counts.all} />
      </div>

      {/* Pesquisas recentes + dica */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <RecentSurveys items={recent} />
        <TemplatesTip />
      </div>
    </div>
  );
}
