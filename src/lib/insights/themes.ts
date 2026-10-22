/*
  Reconhecimento de temas nos comentários — análise de texto DETERMINÍSTICA (dicionário), não
  IA. É o que permite a área Insights mostrar temas, mudanças e recomendações com base nos
  comentários reais hoje, sem inventar nada. Quando houver um motor de IA, ele substitui
  `classifyComment` mantendo o formato de saída. PURO e testado (tests/insights).
*/

export interface ThemeTerm {
  re: RegExp; // aplicado ao texto normalizado (sem acento, minúsculo)
  word: string; // como o termo aparece nas evidências
}

export interface ThemeDef {
  id: string;
  label: string;
  terms: ThemeTerm[];
  /** recomendação quando o tema concentra críticas */
  attentionTitle: string;
  /** recomendação quando o tema concentra pedidos */
  opportunityTitle: string;
  /** false = tema de avaliação genérica: aparece nos temas, mas não vira recomendação */
  actionable?: boolean;
}

const t = (re: RegExp, word: string): ThemeTerm => ({ re, word });

export const THEMES: ThemeDef[] = [
  {
    id: "performance",
    label: "Performance e estabilidade",
    terms: [
      t(/\btrav/, "travamento"),
      t(/carreg/, "carregamento"),
      t(/\blent[oa]s?\b|lentid/, "lentidão"),
      t(/demor/, "demora"),
      t(/n(a|ã)o abre|nao abri|n abre/, "não abre"),
      t(/\bpesad/, "pesado"),
      t(/fora do ar|\bcai\b|caindo|instavel/, "instabilidade"),
      t(/atualiz/, "atualização"),
    ],
    attentionTitle: "Investigue a performance e a estabilidade",
    opportunityTitle: "Melhore o tempo de carregamento",
  },
  {
    id: "bugs",
    label: "Erros e falhas",
    terms: [
      t(/\bbugs?\b|bugad/, "bugs"),
      t(/\berros?\b/, "erro"),
      t(/falha/, "falha"),
      t(/n(a|ã)o contabiliz|nao conta|n conta|nao salv|nao registr/, "não contabiliza"),
      t(/nao aparece|n aparece|nn aparece|incomplet/, "conteúdo não aparece"),
      t(/script/, "uso de script"),
    ],
    attentionTitle: "Corrija os erros mais citados",
    opportunityTitle: "Melhore as mensagens de erro",
  },
  {
    id: "workload",
    label: "Volume de atividades",
    terms: [
      t(/muit[oa]s? (atividade|tarefa|coisa|pergunta|plataforma|texto)|tant[oa]s? (de )?atividade|o tanto de/, "excesso de atividades"),
      t(/excesso|exorbitant/, "excesso"),
      t(/cansativ|sobrecarreg|desanim/, "cansaço"),
      t(/repetitiv/, "repetitivo"),
      t(/todo dia|rotina|\btempo\b|integral/, "falta de tempo"),
      t(/intensiv|horas fazendo|intensidade/, "intensidade"),
    ],
    attentionTitle: "Revise o volume de atividades",
    opportunityTitle: "Equilibre a carga de atividades",
  },
  {
    id: "scoring",
    label: "Pontuação e metas",
    terms: [
      t(/\bpontos?\b|pontua/, "pontuação"),
      t(/ranking/, "ranking"),
      t(/\bmetas?\b/, "metas"),
      t(/\bnotas?\b/, "nota"),
      t(/recompens|mochila|moeda|premio/, "recompensas"),
    ],
    attentionTitle: "Revise as regras de pontuação e metas",
    opportunityTitle: "Torne a pontuação mais transparente",
  },
  {
    id: "content",
    label: "Conteúdo e explicações",
    terms: [
      t(/explica/, "explicações"),
      t(/conteud/, "conteúdo"),
      t(/resum/, "resumos"),
      t(/video|aula/, "videoaulas"),
      t(/questo|questa|alternativ|exercici/, "questões"),
      t(/materia|disciplina|ingles|matematica|portugues|redac/, "matérias"),
      t(/simulad|vestibular|prova/, "simulados e provas"),
      t(/professor/, "professores"),
      t(/apostila|recursos?\b|material/, "materiais"),
    ],
    attentionTitle: "Melhore a clareza do conteúdo",
    opportunityTitle: "Amplie o conteúdo disponível",
  },
  {
    id: "usability",
    label: "Facilidade de uso",
    terms: [
      t(/\bfacil|facilit|intuitiv|simples|pratic/, "facilidade"),
      t(/dificil de (usar|mexer|mecher|entender|navegar)|dificil/, "dificuldade"),
      t(/complicad|confus/, "confusão"),
      t(/organiza/, "organização"),
      t(/mexer|mecher|navega|interface|tela/, "navegação"),
    ],
    attentionTitle: "Simplifique a experiência de uso",
    opportunityTitle: "Facilite os caminhos mais usados",
  },
  {
    id: "engagement",
    label: "Engajamento e motivação",
    terms: [
      t(/\bchat[oa]s?\b/, "chato"),
      t(/desmotiv|desinteress/, "desmotivação"),
      t(/obrigad|obrigac|obrigator/, "obrigatoriedade"),
      t(/desnecessar|perder tempo|nao ensina/, "percepção de inutilidade"),
      t(/interessant|\blegal\b|gostei|adorei|amei|motiv/, "interesse"),
    ],
    attentionTitle: "Entenda a falta de engajamento",
    opportunityTitle: "Reforce o que motiva os usuários",
  },
  {
    id: "support",
    label: "Suporte e atendimento",
    terms: [t(/suporte/, "suporte"), t(/atendiment/, "atendimento"), t(/\bajuda\b/, "ajuda")],
    attentionTitle: "Melhore o atendimento",
    opportunityTitle: "Amplie os canais de ajuda",
  },
  {
    id: "reports",
    label: "Relatórios e dados",
    terms: [t(/relatori/, "relatórios"), t(/export/, "exportação"), t(/grafic|dashboard|indicador/, "gráficos")],
    attentionTitle: "Revise os relatórios",
    opportunityTitle: "Simplifique a exportação de relatórios",
  },
  {
    id: "access",
    label: "Acesso e login",
    terms: [t(/login|logar/, "login"), t(/senha/, "senha"), t(/cadastr/, "cadastro"), t(/\bacess/, "acesso")],
    attentionTitle: "Facilite o acesso",
    opportunityTitle: "Simplifique o login",
  },
  {
    id: "price",
    label: "Preço",
    terms: [t(/\bpreco|\bcaro\b|assinatura|mensalidade/, "preço")],
    attentionTitle: "Revise a percepção de preço",
    opportunityTitle: "Comunique melhor o valor",
  },
  {
    id: "general",
    label: "Percepção geral",
    terms: [
      t(/pessim|horri|horiv|\bruim\b|odeio|detest|nao gostei|nao gosto/, "insatisfação geral"),
      t(/otim[oa]|excelente|incrivel|maravilh|perfeit|\bbo[am]\b|muito bom/, "satisfação geral"),
    ],
    attentionTitle: "",
    opportunityTitle: "",
    actionable: false,
  },
];

export const THEME_BY_ID = new Map(THEMES.map((th) => [th.id, th]));

/** Pedidos de melhoria ("deveria ter", "falta", "poderia"...). */
const REQUEST = /deveria|deveriam|poderia|seria bom|gostaria|queria|\bfalta\b|faltam|falta de|precisa de mais|precisa ter|sugiro|sugest|melhorar|ter mais|mais (simulad|materia|conteud|opco|recurso)/;

const PROFANITY = /\b(bosta|merda|porra|caralho|tmnc|porno|anal|puta|fdp|vsf|krl|pqp|cu|buceta|lixo)\b/;

const STOP = new Set(["nada", "tudo", "nao", "sim", "nn", "sei", "nem", "ok", "pao", "porque", "pois", "isso", "aqui"]);

export function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export interface Classification {
  themes: string[]; // ids
  terms: Record<string, string[]>; // tema → termos encontrados
  request: boolean;
  /** sem conteúdo analisável ("nada", "tudo", "ok") */
  noise: boolean;
  /** contém palavrão: conta nas métricas, mas nunca vai para destaque */
  profane: boolean;
}

export function classifyComment(text: string): Classification {
  const f = fold(text);
  const themes: string[] = [];
  const terms: Record<string, string[]> = {};
  for (const th of THEMES) {
    const hit = th.terms.filter((term) => term.re.test(f)).map((term) => term.word);
    if (hit.length) {
      themes.push(th.id);
      terms[th.id] = Array.from(new Set(hit));
    }
  }
  const words = f.split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w));
  return {
    themes,
    terms,
    request: REQUEST.test(f),
    noise: themes.length === 0 && words.length < 2,
    profane: PROFANITY.test(f),
  };
}
