export interface Response {
  id: string;
  user: string;
  score: number;
  sentiment: "positivo" | "neutro" | "negativo";
  comment: string;
  channel: string;
  when: string;
}

export const responses: Response[] = [
  { id: "r1", user: "Marina Souza", score: 9, sentiment: "positivo", comment: "A plataforma é muito intuitiva, consegui criar minha primeira pesquisa em minutos!", channel: "E-mail", when: "há 12 min" },
  { id: "r2", user: "Carlos Lima", score: 6, sentiment: "neutro", comment: "Boa ferramenta, mas senti falta de mais opções de exportação.", channel: "In-app", when: "há 40 min" },
  { id: "r3", user: "Ana Beatriz", score: 3, sentiment: "negativo", comment: "Tive dificuldade para configurar o disparo por evento. Precisa de mais clareza.", channel: "WhatsApp", when: "há 1h" },
  { id: "r4", user: "Pedro Alves", score: 10, sentiment: "positivo", comment: "Melhor experiência de feedback que já usei. O mascote é um charme!", channel: "Link", when: "há 2h" },
  { id: "r5", user: "Júlia Nunes", score: 8, sentiment: "positivo", comment: "Dashboards claros e insights muito úteis para o time de produto.", channel: "E-mail", when: "há 3h" },
  { id: "r6", user: "Rafael Dias", score: 5, sentiment: "neutro", comment: "Funciona bem, mas o carregamento dos heatmaps poderia ser mais rápido.", channel: "In-app", when: "há 5h" },
];

export const distribution = [
  { label: "5 ★", value: 54, tone: "var(--luumu-verde)" },
  { label: "4 ★", value: 24, tone: "var(--luumu-verde)" },
  { label: "3 ★", value: 12, tone: "var(--sec-amarelo)" },
  { label: "2 ★", value: 6, tone: "var(--sec-laranja)" },
  { label: "1 ★", value: 4, tone: "var(--erro)" },
];

export const topThemes = [
  "Atendimento", "Produto", "Usabilidade", "Preço", "Onboarding", "Performance",
];
