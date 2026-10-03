/*
  Emojis de emoção do mascote (public/mascot/emotions) e a régua de sentimento usada para
  escolher entre eles. PURO: usado em componentes de servidor e de cliente.
*/
// faixas definidas pelo produto: 0–29 | 30–49 | 50–69 | 70–89 | 90–100
export const MOODS = [
  { max: 30, range: "0–29%", src: "/mascot/emotions/1-chorando.webp", label: "Muito negativo" },
  { max: 50, range: "30–49%", src: "/mascot/emotions/2-triste.webp", label: "Negativo" },
  { max: 70, range: "50–69%", src: "/mascot/emotions/3-pensativo.webp", label: "Neutro" },
  { max: 90, range: "70–89%", src: "/mascot/emotions/4-feliz.webp", label: "Positivo" },
  { max: 101, range: "90–100%", src: "/mascot/emotions/5-empolgado.webp", label: "Muito positivo" },
] as const;
export const moodFor = (pct: number) => MOODS.find((m) => pct < m.max) ?? MOODS[MOODS.length - 1];

/** Emoji de cada nível de sentimento (legendas da área Insights). */
export const LEVEL_EMOJI = {
  very_positive: "/mascot/emotions/5-empolgado.webp",
  positive: "/mascot/emotions/4-feliz.webp",
  neutral: "/mascot/emotions/3-pensativo.webp",
  negative: "/mascot/emotions/2-triste.webp",
  very_negative: "/mascot/emotions/1-chorando.webp",
} as const;

/** Emoji para o sentimento de um comentário (positivo/neutro/negativo). */
export const SENTIMENT_EMOJI: Record<"positivo" | "neutro" | "negativo", string> = {
  positivo: LEVEL_EMOJI.positive,
  neutro: LEVEL_EMOJI.neutral,
  negativo: LEVEL_EMOJI.negative,
};
