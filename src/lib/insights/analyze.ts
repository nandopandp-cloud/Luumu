/*
  Motor de análise da área Insights. PURO: recebe as respostas do período (e do período
  anterior) já lidas do banco e devolve o `InsightsData` que a UI consome. Nada aqui inventa
  número: tudo sai das respostas e do dicionário de temas (lib/insights/themes.ts).
*/
import { classifyComment, THEME_BY_ID, THEMES, type Classification } from "./themes";
import {
  LEVEL_LABEL,
  SENTIMENT_LEVELS,
  type ChangeInsight,
  type FeedbackComment,
  type InsightsData,
  type InsightSummary,
  type Recommendation,
  type SatisfactionMetric,
  type SentimentCategory,
  type SentimentLevel,
  type SentimentPoint,
  type TopicInsight,
} from "./types";

export interface AnalyzedResponse {
  id: string;
  createdAt: Date;
  score: number | null;
  sentiment: "positivo" | "neutro" | "negativo" | null;
  /** nível em 5 faixas (já calculado pela escala da pesquisa); null = sem nota nem sentimento */
  level: SentimentLevel | null;
  comment: string;
}

export interface AnalyzeInput {
  periodLabel: string;
  now: Date;
  from?: Date;
  to?: Date;
  current: AnalyzedResponse[];
  /** null = não há período anterior comparável (ex.: "todo o período") */
  previous: AnalyzedResponse[] | null;
  satisfaction: SatisfactionMetric | null;
}

/** Nível de sentimento pela posição da nota na escala (1–5 → 0..1; NPS 0–10 → 0..1). */
export function levelFromScore(score: number, scale: { min: number; max: number }): SentimentLevel {
  const span = scale.max - scale.min || 1;
  const p = Math.min(1, Math.max(0, (score - scale.min) / span));
  if (p >= 0.875) return "very_positive";
  if (p >= 0.625) return "positive";
  if (p >= 0.375) return "neutral";
  if (p >= 0.125) return "negative";
  return "very_negative";
}

export function levelFromSentiment(s: AnalyzedResponse["sentiment"]): SentimentLevel | null {
  return s === "positivo" ? "positive" : s === "negativo" ? "negative" : s === "neutro" ? "neutral" : null;
}

export function relativeDay(d: Date, now: Date): string {
  const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (days <= 0) return "Hoje";
  if (days === 1) return "Ontem";
  if (days < 30) return `Há ${days} dias`;
  const months = Math.floor(days / 30);
  return months === 1 ? "Há 1 mês" : `Há ${months} meses`;
}

const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

function bucketKey(d: Date, g: "week" | "day"): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  if (g === "week") t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7)); // segunda-feira
  return t.toISOString().slice(0, 10);
}

/* ---------- sentimento ---------- */

function distribution(rows: AnalyzedResponse[]): SentimentCategory[] {
  const withLevel = rows.filter((r) => r.level);
  return SENTIMENT_LEVELS.map((level) => {
    const count = withLevel.filter((r) => r.level === level).length;
    return { level, label: LEVEL_LABEL[level], count, pct: pct(count, withLevel.length) };
  });
}

function evolution(rows: AnalyzedResponse[], to: Date, g: "week" | "day"): SentimentPoint[] {
  const buckets = new Map<string, AnalyzedResponse[]>();
  for (const r of rows) {
    if (!r.level) continue;
    const k = bucketKey(r.createdAt, g);
    buckets.set(k, [...(buckets.get(k) ?? []), r]);
  }
  const keys = Array.from(buckets.keys()).sort();
  if (!keys.length) return [];
  // começa na primeira semana com resposta (os dados já vêm recortados pelo período):
  // semanas vazias antes dela não são "0%"
  const start = keys[0];
  const out: SentimentPoint[] = [];
  const step = (g === "week" ? 7 : 1) * 86_400_000;
  for (let t = new Date(`${start}T00:00:00Z`); t <= to; t = new Date(t.getTime() + step)) {
    const k = t.toISOString().slice(0, 10);
    const list = buckets.get(k) ?? [];
    const levels = list.length
      ? (Object.fromEntries(
          SENTIMENT_LEVELS.map((l) => [l, pct(list.filter((r) => r.level === l).length, list.length)])
        ) as Record<SentimentLevel, number>)
      : null;
    out.push({ key: k, label: `${k.slice(8, 10)}/${k.slice(5, 7)}`, total: list.length, levels });
  }
  return out.slice(g === "week" ? -12 : -45);
}

/* ---------- comentários e temas ---------- */

interface Classified {
  r: AnalyzedResponse;
  c: Classification;
}

function classify(rows: AnalyzedResponse[]): Classified[] {
  return rows.filter((r) => r.comment.trim()).map((r) => ({ r, c: classifyComment(r.comment) }));
}

function toComment(x: Classified, now: Date): FeedbackComment {
  return {
    id: x.r.id,
    text: x.r.comment.trim().replace(/\s+/g, " ").slice(0, 400),
    sentiment: x.r.sentiment,
    score: x.r.score,
    themes: x.c.themes.map((id) => THEME_BY_ID.get(id)!.label),
    when: relativeDay(x.r.createdAt, now),
    createdAt: x.r.createdAt.toISOString(),
  };
}

/** Comentários bons de mostrar: com conteúdo, sem palavrão, mais informativos primeiro. */
function showable(list: Classified[]): Classified[] {
  return list
    .filter((x) => !x.c.noise && !x.c.profane && x.r.comment.trim().length >= 12)
    .sort((a, b) => Math.min(b.r.comment.length, 220) - Math.min(a.r.comment.length, 220) || +b.r.createdAt - +a.r.createdAt);
}

function topicsOf(cls: Classified[], now: Date): { topics: TopicInsight[]; classified: number } {
  const themed = cls.filter((x) => x.c.themes.length);
  const topics: TopicInsight[] = THEMES.map((th) => {
    const mine = themed.filter((x) => x.c.themes.includes(th.id));
    const kw = new Map<string, number>();
    for (const x of mine) for (const w of x.c.terms[th.id] ?? []) kw.set(w, (kw.get(w) ?? 0) + 1);
    return {
      id: th.id,
      label: th.label,
      count: mine.length,
      pct: pct(mine.length, themed.length),
      positive: mine.filter((x) => x.r.sentiment === "positivo").length,
      negative: mine.filter((x) => x.r.sentiment === "negativo").length,
      neutral: mine.filter((x) => x.r.sentiment === "neutro").length,
      keywords: Array.from(kw.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([word, count]) => ({ word, count })),
      samples: showable(mine).slice(0, 8).map((x) => toComment(x, now)),
    };
  })
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count);
  return { topics, classified: themed.length };
}

/* ---------- o que mudou ---------- */

function changesOf(cur: Classified[], prev: Classified[] | null): ChangeInsight[] {
  if (!prev || prev.length === 0) return [];
  const curN = cur.length || 1;
  const prevN = prev.length || 1;
  const share = (list: Classified[], n: number, id: string, s: "positivo" | "negativo") =>
    list.filter((x) => x.c.themes.includes(id) && x.r.sentiment === s).length / n;
  const out: ChangeInsight[] = [];
  for (const th of THEMES) {
    const mentions =
      cur.filter((x) => x.c.themes.includes(th.id)).length + prev.filter((x) => x.c.themes.includes(th.id)).length;
    if (mentions < 3) continue; // pouca base: variação seria ruído
    let best: ChangeInsight | null = null;
    for (const s of ["negativo", "positivo"] as const) {
      const a = share(cur, curN, th.id, s);
      const b = share(prev, prevN, th.id, s);
      if (a === 0 && b === 0) continue;
      const change = b === 0 ? 100 : Math.round(((a - b) / b) * 100);
      if (change === 0) continue;
      const word = s === "negativo" ? "negativas" : "positivas";
      const cand: ChangeInsight = {
        id: th.id,
        label: th.label,
        change,
        good: s === "positivo" ? change > 0 : change < 0,
        description:
          b === 0
            ? `Menções ${word} apareceram neste período.`
            : `Menções ${word} ${change > 0 ? "aumentaram" : "diminuíram"} ${Math.abs(change)}%.`,
      };
      if (!best || Math.abs(cand.change) > Math.abs(best.change)) best = cand;
    }
    if (best) out.push(best);
  }
  // todas, da maior variação para a menor (a tela mostra as 4 primeiras; "Comparar períodos", todas)
  return out.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
}

/* ---------- recomendações e resumo ---------- */

function recommendationsOf(topics: TopicInsight[], cls: Classified[], now: Date): {
  recs: Recommendation[];
  attention: TopicInsight[];
  opportunities: { topic: TopicInsight; requests: Classified[] }[];
  positives: TopicInsight[];
} {
  const actionable = topics.filter((t) => THEME_BY_ID.get(t.id)?.actionable !== false);
  const attention = actionable
    .filter((t) => t.negative >= 2 && t.negative / t.count >= 0.5)
    .sort((a, b) => b.negative - a.negative);
  const positives = topics
    .filter((t) => t.positive >= 2 && t.positive / t.count >= 0.5)
    .sort((a, b) => b.positive - a.positive);
  const opportunities = actionable
    .map((topic) => ({ topic, requests: cls.filter((x) => x.c.request && x.c.themes.includes(topic.id)) }))
    .filter((o) => o.requests.length >= 2)
    .sort((a, b) => b.requests.length - a.requests.length);

  const evidenceOf = (topic: TopicInsight, list: Classified[]) => ({
    analyzed: topic.count,
    facts: topic.keywords.slice(0, 4).map((k) => ({ label: `mencionam ${k.word}`, count: k.count })),
    comments: showable(list)
      .sort((a, b) => (a.r.sentiment === "negativo" ? -1 : 0) - (b.r.sentiment === "negativo" ? -1 : 0))
      .slice(0, 10)
      .map((x) => toComment(x, now)),
  });

  const recs: Recommendation[] = [];
  for (const t of attention.slice(0, 3)) {
    const def = THEME_BY_ID.get(t.id)!;
    const top = t.keywords[0];
    recs.push({
      id: `att-${t.id}`,
      kind: "attention",
      themeId: t.id,
      title: def.attentionTitle,
      description: `${pct(t.negative, t.count)}% dos comentários sobre ${lower(t.label)} são negativos${
        top ? ` e ${top.count} mencionam ${top.word}` : ""
      }.`,
      evidence: evidenceOf(t, cls.filter((x) => x.c.themes.includes(t.id))),
    });
  }
  for (const o of opportunities) {
    if (recs.length >= 3) break;
    if (recs.some((r) => r.themeId === o.topic.id)) continue;
    const def = THEME_BY_ID.get(o.topic.id)!;
    recs.push({
      id: `opp-${o.topic.id}`,
      kind: "opportunity",
      themeId: o.topic.id,
      title: def.opportunityTitle,
      description: `${o.requests.length} ${o.requests.length === 1 ? "comentário pede" : "comentários pedem"} melhorias em ${lower(o.topic.label)}.`,
      evidence: evidenceOf(o.topic, o.requests),
    });
  }
  return { recs, attention, opportunities, positives };
}

function summaryOf(
  dist: SentimentCategory[],
  satisfaction: SatisfactionMetric | null,
  attention: TopicInsight[],
  positives: TopicInsight[],
  opportunities: { topic: TopicInsight }[]
): InsightSummary {
  const good = dist.filter((d) => d.level === "very_positive" || d.level === "positive").reduce((s, d) => s + d.pct, 0);
  const mood = good >= 70 ? "permanece positiva" : good >= 50 ? "está dividida" : "está baixa";
  const parts = [`A satisfação geral ${mood}${satisfaction ? ` (${satisfaction.label} ${satisfaction.value})` : ""}`];
  if (attention[0]) parts[0] += `, com sinais de atenção relacionados a ${lower(attention[0].label)}`;
  parts[0] += ".";
  if (positives[0]) parts.push(`O principal fator positivo é ${lower(positives[0].label)}.`);
  const nA = attention.length;
  const nO = opportunities.length;
  return {
    headline: parts.join(" "),
    detail:
      nA || nO
        ? `A Luumu identificou ${nA} ${nA === 1 ? "tema que merece" : "temas que merecem"} investigação e ${nO} ${
            nO === 1 ? "oportunidade recorrente" : "oportunidades recorrentes"
          } nos comentários.`
        : "Nenhum tema concentra críticas ou pedidos recorrentes neste período.",
    positives: { count: positives.length, items: positives.map((t) => t.label) },
    attention: { count: nA, items: attention.map((t) => t.label) },
    opportunities: { count: nO, items: opportunities.map((o) => o.topic.label) },
  };
}

function featuredOf(cls: Classified[], now: Date): FeedbackComment[] {
  const pick = (s: AnalyzedResponse["sentiment"]) =>
    showable(cls.filter((x) => x.r.sentiment === s && x.c.themes.length)).slice(0, 1);
  const chosen = [...pick("positivo"), ...pick("negativo")];
  // sem par positivo/negativo, completa com os mais informativos do período
  for (const x of showable(cls)) {
    if (chosen.length >= 2) break;
    if (!chosen.includes(x)) chosen.push(x);
  }
  return chosen.map((x) => toComment(x, now));
}

export function analyzeInsights(input: AnalyzeInput): InsightsData {
  const cur = classify(input.current);
  const prev = input.previous ? classify(input.previous) : null;
  const dist = distribution(input.current);
  const { topics, classified } = topicsOf(cur, input.now);
  const { recs, attention, opportunities, positives } = recommendationsOf(topics, cur, input.now);

  return {
    periodLabel: input.periodLabel,
    totalResponses: input.current.length,
    totalComments: cur.length,
    classifiedComments: classified,
    hasPrevious: !!input.previous && input.previous.length > 0,
    summary: summaryOf(dist, input.satisfaction, attention, positives, opportunities),
    satisfaction: input.satisfaction,
    sentimentEvolution: {
      week: evolution(input.current, input.to ?? input.now, "week"),
      day: evolution(input.current, input.to ?? input.now, "day"),
    },
    sentimentDistribution: dist,
    topics,
    changes: changesOf(cur, prev),
    recommendations: recs,
    featuredComments: featuredOf(cur, input.now),
  };
}
