/*
  "Pergunte algo sobre seus dados" — versão sem IA generativa. Reconhece a intenção da
  pergunta e responde com os números do próprio InsightsData (os mesmos da tela). Pergunta
  fora dessas intenções recebe `answered: false` e uma resposta honesta, nunca um texto
  inventado. Quando houver motor de IA, ele implementa esta mesma assinatura.
*/
import { fold } from "./themes";
import type { InsightAnswer, InsightsData } from "./types";

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const list = (items: string[]) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;

type Intent = "drop" | "problems" | "improved" | "requests" | "topics" | "sentiment";

const INTENTS: { intent: Intent; re: RegExp }[] = [
  { intent: "drop", re: /(caiu|cair|caindo|queda|piorou|baixou|diminuiu|despencou).*(csat|nps|ces|nota|satisfa)|(csat|nps|ces|nota|satisfa).*(caiu|queda|piorou|baixou|diminuiu)/ },
  { intent: "requests", re: /pedem|pedido|funcionalidade|querem|sugest|sugere|falta|desejam|gostariam/ },
  { intent: "improved", re: /melhorou|melhoraram|subiu|aumentou|evolu|positivo|elogi|ponto forte|funcionando/ },
  { intent: "problems", re: /problema|reclama|critica|ruim|pior|negativ|atencao|dor|dores|insatisf/ },
  { intent: "topics", re: /tema|assunto|falam|fala sobre|mencionad|topico/ },
  { intent: "sentiment", re: /sentimento|humor|como (estao|esta)|clientes se sentem/ },
];

export function detectIntent(question: string): Intent | null {
  const q = fold(question);
  return INTENTS.find((i) => i.re.test(q))?.intent ?? null;
}

export function answerQuestion(question: string, d: InsightsData): InsightAnswer {
  const base = { question };
  if (d.totalResponses === 0) {
    return { ...base, answered: true, text: `Ainda não há respostas em ${d.periodLabel} para responder a isso.`, bullets: [] };
  }
  const sat = d.satisfaction;
  const neg = d.changes.filter((c) => !c.good);
  const pos = d.changes.filter((c) => c.good);

  switch (detectIntent(question)) {
    case "drop": {
      const delta = sat?.delta;
      const head = !sat
        ? "Não há pergunta de nota nas pesquisas deste recorte."
        : !delta
        ? `O ${sat.label} está em ${sat.value}. Não há período anterior com respostas para comparar.`
        : (delta.inverted ? delta.value > 0 : delta.value < 0) // piorou (no CES, nota maior é pior)
        ? `O ${sat.label} ${delta.inverted ? "subiu" : "caiu"} ${Math.abs(delta.value)} ${delta.unit} (agora ${sat.value}) — ou seja, piorou.`
        : `O ${sat.label} não piorou: variou ${delta.value > 0 ? "+" : ""}${delta.value} ${delta.unit} (agora ${sat.value}).`;
      const bullets = [
        ...d.summary.attention.items.slice(0, 3).map((t) => `${t} concentra comentários negativos`),
        ...neg.slice(0, 2).map((c) => `${c.label}: ${lower(c.description)}`),
      ];
      return { ...base, answered: true, text: head, bullets, anchor: "changes" };
    }
    case "problems": {
      if (!d.summary.attention.count) {
        return { ...base, answered: true, text: "Nenhum tema concentra críticas recorrentes neste período.", bullets: [], anchor: "topics" };
      }
      const bullets = d.topics
        .filter((t) => d.summary.attention.items.includes(t.label))
        .slice(0, 4)
        .map((t) => `${t.label}: ${t.negative} comentários negativos${t.keywords[0] ? ` (mais citado: ${t.keywords[0].word})` : ""}`);
      return {
        ...base,
        answered: true,
        text: `Os principais problemas citados são ${list(d.summary.attention.items.slice(0, 3).map(lower))}.`,
        bullets,
        anchor: "recommendations",
      };
    }
    case "improved": {
      if (!d.hasPrevious) {
        return { ...base, answered: true, text: "Não há período anterior com respostas para comparar.", bullets: d.summary.positives.items.map((t) => `${t} é citado positivamente`), anchor: "topics" };
      }
      const bullets = pos.map((c) => `${c.label}: ${lower(c.description)}`);
      return {
        ...base,
        answered: true,
        text: bullets.length ? "Estes temas evoluíram em relação ao período anterior:" : "Nenhum tema teve melhora relevante em relação ao período anterior.",
        bullets,
        anchor: "changes",
      };
    }
    case "requests": {
      const opp = d.recommendations.filter((r) => r.kind === "opportunity");
      if (!d.summary.opportunities.count) {
        return { ...base, answered: true, text: "Não encontramos pedidos recorrentes nos comentários deste período.", bullets: [], anchor: "recommendations" };
      }
      return {
        ...base,
        answered: true,
        text: `Os pedidos mais recorrentes envolvem ${list(d.summary.opportunities.items.slice(0, 3).map(lower))}.`,
        bullets: opp.flatMap((r) => r.evidence.comments.slice(0, 2).map((c) => `“${c.text.slice(0, 140)}”`)),
        anchor: "recommendations",
      };
    }
    case "topics":
      return {
        ...base,
        answered: true,
        text: `Os temas mais mencionados em ${d.periodLabel}:`,
        bullets: d.topics.slice(0, 5).map((t) => `${t.label} — ${t.pct}% dos comentários`),
        anchor: "topics",
      };
    case "sentiment":
      return {
        ...base,
        answered: true,
        text: `Distribuição de sentimento em ${d.periodLabel}:`,
        bullets: d.sentimentDistribution.map((s) => `${s.label}: ${s.pct}%`),
        anchor: "evolution",
      };
    default:
      return {
        ...base,
        answered: false,
        text: "Ainda não consigo responder perguntas livres. Por enquanto respondo sobre queda da nota, principais problemas, o que melhorou, pedidos dos clientes, temas e sentimento.",
        bullets: [],
      };
  }
}

export const SUGGESTED_QUESTIONS = [
  "Por que o CSAT caiu este mês?",
  "Quais são os principais problemas?",
  "O que melhorou no último período?",
  "Quais funcionalidades os clientes pedem?",
];
