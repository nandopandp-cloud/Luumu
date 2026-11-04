/**
 * CSAT de uma plataforma na quinzena: média simples das notas das DUAS pesquisas CSAT mais
 * recentes da quinzena (as pesquisas são semanais, então são as duas semanas da quinzena). Cada
 * nota é a % top-box da pesquisa, só com as respostas da quinzena, como no painel. "Mais recente"
 * = a que recebeu a última resposta mais tarde.
 *
 * Com uma pesquisa só, o CSAT é o dela (dividir por dois inventaria um zero) e vira aviso.
 * Puro (sem banco): usado pela coleta e pelos testes.
 */

export const CSAT_SURVEYS_PER_PERIOD = 2;

export interface SurveyCsat {
  surveyName: string;
  /** % top-box; null = pesquisa sem nota calculável */
  value: number | null;
  /** respostas com nota na quinzena */
  answered: number;
  /** última resposta na quinzena (ms) */
  lastAt: number;
}

export interface PeriodCsat {
  value: number | null;
  /** pesquisas usadas, da mais recente para a mais antiga */
  used: SurveyCsat[];
  detail?: string;
  warnings: string[];
}

const pct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export function csatFromSurveys(surveys: SurveyCsat[]): PeriodCsat {
  const used = surveys
    .filter((s): s is SurveyCsat & { value: number } => typeof s.value === "number" && Number.isFinite(s.value))
    .sort((a, b) => b.lastAt - a.lastAt)
    .slice(0, CSAT_SURVEYS_PER_PERIOD);
  if (!used.length) return { value: null, used: [], warnings: ["nenhuma resposta de pesquisa CSAT na quinzena"] };

  const value = used.reduce((a, s) => a + s.value, 0) / used.length;
  const each = used.map((s) => `${s.surveyName}: ${pct(s.value)} (${s.answered} respostas)`).join(" · ");
  return {
    value,
    used,
    detail: used.length > 1 ? `Média das ${used.length} últimas pesquisas · ${each}` : each,
    warnings: used.length < CSAT_SURVEYS_PER_PERIOD ? ["só 1 pesquisa CSAT com respostas na quinzena: o CSAT é o dela, sem média com outra"] : [],
  };
}
