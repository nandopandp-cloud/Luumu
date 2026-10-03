/*
  Respostas por regras da conversa com a Luumu — o plano B quando a IA não está disponível
  (sem chave, cota esgotada, provedor fora). Reconhece a intenção e responde com os números
  do próprio InsightsData. Pergunta fora dessas intenções recebe `answered: false` e uma
  resposta honesta, nunca um texto inventado. PURO e testado.
*/
import { fold } from "./themes";
import type { AnswerPoint, AnswerVisual, ChatTurn, InsightAnswer, InsightsData } from "./types";

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const list = (items: string[]) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;

export type Intent = "drop" | "problems" | "improved" | "requests" | "topics" | "sentiment" | "comments" | "recommendations";

const INTENTS: { intent: Intent; re: RegExp }[] = [
  { intent: "drop", re: /(caiu|cair|caindo|queda|piorou|baixou|diminuiu|despencou).*(csat|nps|ces|nota|satisfa)|(csat|nps|ces|nota|satisfa).*(caiu|queda|piorou|baixou|diminuiu)/ },
  { intent: "recommendations", re: /recomenda|o que (eu )?(devo|deveria|posso) fazer|priorizar|prioridade|proximos passos|\bacao\b|\bacoes\b/ },
  { intent: "requests", re: /pedem|pedido|funcionalidade|querem|sugest|sugere|falta|desejam|gostariam/ },
  { intent: "comments", re: /comentario|o que (os clientes|os usuarios|eles) (dizem|falam|escreveram)|exemplos?/ },
  { intent: "improved", re: /melhorou|melhoraram|subiu|aumentou|evolu|positivo|elogi|ponto forte|funcionando|o que mudou|mudanca/ },
  { intent: "problems", re: /problema|reclama|critica|ruim|pior|negativ|atencao|dor|dores|insatisf/ },
  { intent: "topics", re: /tema|assunto|falam|fala sobre|mencionad|topico/ },
  { intent: "sentiment", re: /sentimento|humor|como (estao|esta)|clientes se sentem|satisfa/ },
];

export function detectIntent(question: string): Intent | null {
  const q = fold(question);
  return INTENTS.find((i) => i.re.test(q))?.intent ?? null;
}

const AFFIRMATIVE = /^(sim|s|claro|pode|quero|ok|okay|beleza|manda|mostra|mostre|por favor|bora|vamos)\b/;

/**
 * Intenção de uma resposta curta ("sim", "pode mostrar") vem da última pergunta da Luumu:
 * "Quer que eu mostre os temas?" + "sim" = pergunta sobre temas.
 */
export function intentWithContext(question: string, history: ChatTurn[] = []): Intent | null {
  const direct = detectIntent(question);
  if (direct) return direct;
  if (!AFFIRMATIVE.test(fold(question))) return null;
  const lastLuumu = [...history].reverse().find((t) => t.role === "assistant");
  if (!lastLuumu) return null;
  // o "sim" responde à ÚLTIMA pergunta da Luumu ("Quer que eu mostre os temas?"), não ao resto
  // da mensagem — que pode falar de outra coisa ("O CSAT subiu...")
  const offer = lastLuumu.content.split(/(?<=[.!?])\s+/).reverse().find((s) => s.trim().endsWith("?"));
  return detectIntent(offer ?? lastLuumu.content);
}

type Base = Pick<InsightAnswer, "question" | "source" | "answered">;

function make(
  base: Base,
  a: { title: string; text?: string; points?: AnswerPoint[]; visual?: AnswerVisual; followUp?: string; suggestions?: string[]; anchor?: InsightAnswer["anchor"] }
): InsightAnswer {
  return {
    ...base,
    title: a.title,
    text: a.text ?? "",
    points: a.points ?? [],
    visual: a.visual ?? "none",
    followUp: a.followUp ?? "",
    suggestions: a.suggestions ?? [],
    anchor: a.anchor,
  };
}

export function answerQuestion(question: string, d: InsightsData, history: ChatTurn[] = []): InsightAnswer {
  const base: Base = { question, source: "rules", answered: true };
  if (d.totalResponses === 0) {
    return make(base, { title: `Ainda não há respostas em ${d.periodLabel}.`, text: "Assim que as pesquisas receberem respostas, consigo analisar." });
  }
  const sat = d.satisfaction;
  const bad = d.changes.filter((c) => !c.good);
  const good = d.changes.filter((c) => c.good);
  const changePoint = (c: (typeof d.changes)[number]): AnswerPoint => ({ text: `${c.label}: ${lower(c.description)}`, trend: c.good ? "up" : "down" });

  switch (intentWithContext(question, history)) {
    case "drop": {
      const delta = sat?.delta;
      const worse = delta ? (delta.inverted ? delta.value > 0 : delta.value < 0) : false;
      const title = !sat
        ? "As pesquisas deste recorte não têm pergunta de nota."
        : !delta
        ? `O ${sat.label} está em ${sat.value}, mas não há período anterior para comparar.`
        : worse
        ? `O ${sat.label} ${delta.inverted ? "subiu" : "caiu"} ${Math.abs(delta.value)} ${delta.unit}, para ${sat.value}.`
        : `O ${sat.label} não caiu: variou ${delta.value > 0 ? "+" : ""}${delta.value} ${delta.unit}, para ${sat.value}.`;
      const points = [
        ...d.summary.attention.items.slice(0, 2).map((t): AnswerPoint => ({ text: `${t} concentra comentários negativos`, trend: "down" })),
        ...bad.slice(0, 2).map(changePoint),
      ];
      return make(base, {
        title,
        text: points.length ? "Estes são os pontos que mais pesam contra a satisfação:" : "",
        points,
        visual: "satisfaction",
        followUp: "Quer ver as recomendações para esses pontos?",
        suggestions: ["Sim, mostre as recomendações", "Quais são os principais problemas?", "Ver comentários"],
        anchor: "changes",
      });
    }
    case "problems": {
      if (!d.summary.attention.count) {
        return make(base, { title: "Nenhum tema concentra críticas recorrentes neste período.", visual: "topics", anchor: "topics", suggestions: ["O que melhorou no último período?"] });
      }
      const points = d.topics
        .filter((t) => d.summary.attention.items.includes(t.label))
        .slice(0, 4)
        .map((t): AnswerPoint => ({
          text: `${t.label}: ${t.negative} comentários negativos`,
          detail: t.keywords[0] ? `Mais citado: ${t.keywords.slice(0, 3).map((k) => k.word).join(", ")}` : undefined,
          trend: "down",
        }));
      return make(base, {
        title: `Os principais problemas são ${list(d.summary.attention.items.slice(0, 3).map(lower))}.`,
        text: "É onde os comentários negativos se concentram:",
        points,
        visual: "recommendations",
        followUp: "Quer ver comentários que mostram esses problemas?",
        suggestions: ["Sim, mostre os comentários", "O que devo priorizar?", "Como está o sentimento?"],
        anchor: "recommendations",
      });
    }
    case "improved": {
      if (!d.hasPrevious) {
        return make(base, {
          title: "Não há período anterior com respostas para comparar.",
          text: d.summary.positives.items.length ? "Mas estes temas são citados positivamente agora:" : "",
          points: d.summary.positives.items.map((t): AnswerPoint => ({ text: t, trend: "up" })),
          visual: "satisfaction",
          suggestions: ["Quais são os principais problemas?", "Quais temas os clientes mais citam?"],
          anchor: "topics",
        });
      }
      const delta = sat?.delta;
      const up = delta ? (delta.inverted ? delta.value < 0 : delta.value > 0) : false;
      return make(base, {
        title:
          sat && delta && up
            ? `O ${sat.label} subiu ${Math.abs(delta.value)} ${delta.unit}, para ${sat.value}.`
            : good.length
            ? "Alguns temas evoluíram em relação ao período anterior."
            : "Nenhum tema teve melhora relevante em relação ao período anterior.",
        text: good.length ? "Estes são os fatores que mais contribuíram:" : "",
        points: good.slice(0, 4).map(changePoint),
        visual: "satisfaction",
        followUp: "Quer que eu mostre quais temas mais contribuíram para essa melhora?",
        suggestions: ["Sim, mostre os temas", "Ver comentários", "Quais são os principais problemas?"],
        anchor: "changes",
      });
    }
    case "requests": {
      if (!d.summary.opportunities.count) {
        return make(base, { title: "Não encontrei pedidos recorrentes nos comentários deste período.", visual: "comments", anchor: "comments", suggestions: ["Quais são os principais problemas?"] });
      }
      const opp = d.recommendations.filter((r) => r.kind === "opportunity");
      return make(base, {
        title: `Os pedidos mais recorrentes envolvem ${list(d.summary.opportunities.items.slice(0, 3).map(lower))}.`,
        text: "Alguns exemplos do que os clientes escreveram:",
        points: opp.flatMap((r) => r.evidence.comments.slice(0, 2).map((c): AnswerPoint => ({ text: `“${c.text.slice(0, 160)}”`, detail: c.themes.join(", ") }))),
        visual: "recommendations",
        followUp: "Quer ver as recomendações para esses pedidos?",
        suggestions: ["Sim, mostre as recomendações", "Quais temas os clientes mais citam?"],
        anchor: "recommendations",
      });
    }
    case "recommendations":
      return make(base, {
        title: d.recommendations.length
          ? `Minha principal recomendação: ${lower(d.recommendations[0].title)}.`
          : "Nenhum tema concentra críticas ou pedidos suficientes para uma recomendação.",
        text: d.recommendations.length ? "Estas são as ações sugeridas, em ordem de prioridade:" : "",
        points: d.recommendations.map((r): AnswerPoint => ({ text: r.title, detail: r.description, trend: r.kind === "attention" ? "down" : "neutral" })),
        visual: "recommendations",
        followUp: d.recommendations.length ? "Quer ver os comentários que sustentam essas recomendações?" : "",
        suggestions: ["Sim, mostre os comentários", "Quais são os principais problemas?"],
        anchor: "recommendations",
      });
    case "comments":
      return make(base, {
        title: d.featuredComments.length ? "Aqui estão comentários que representam bem o período:" : "Ainda não há comentários neste período.",
        visual: "comments",
        followUp: "Quer ver os temas que aparecem nesses comentários?",
        suggestions: ["Sim, mostre os temas", "O que devo priorizar?"],
        anchor: "comments",
      });
    case "topics":
      return make(base, {
        title: d.topics.length ? `Os temas mais mencionados em ${d.periodLabel}:` : "Ainda não há comentários suficientes para identificar temas.",
        text: d.topics[0] ? `${d.topics[0].label} lidera, com ${d.topics[0].pct}% dos comentários com tema.` : "",
        visual: "topics",
        followUp: d.hasPrevious ? "Quer ver o que mudou em cada tema em relação ao período anterior?" : "",
        suggestions: d.hasPrevious ? ["Sim, mostre o que mudou", "Quais são os principais problemas?"] : ["Quais são os principais problemas?"],
        anchor: "topics",
      });
    case "sentiment": {
      const g = d.sentimentDistribution.filter((s) => s.level === "very_positive" || s.level === "positive").reduce((a, s) => a + s.pct, 0);
      return make(base, {
        title: `${g}% das respostas de ${d.periodLabel} são positivas ou muito positivas.`,
        visual: "sentiment",
        followUp: "Quer saber o que explica as respostas negativas?",
        suggestions: ["Sim, quais são os principais problemas?", "O que melhorou no último período?"],
        anchor: "evolution",
      });
    }
    default:
      return make(
        { ...base, answered: false },
        {
          title: "Ainda não consigo responder essa pergunta.",
          text: "Por enquanto respondo sobre queda da nota, principais problemas, o que melhorou, pedidos dos clientes, recomendações, temas, sentimento e comentários.",
          suggestions: SUGGESTED_QUESTIONS.slice(0, 3),
        }
      );
  }
}

export const SUGGESTED_QUESTIONS = [
  "Por que o CSAT caiu este mês?",
  "Quais são os principais problemas?",
  "O que melhorou no último período?",
  "Quais funcionalidades os clientes pedem?",
];
