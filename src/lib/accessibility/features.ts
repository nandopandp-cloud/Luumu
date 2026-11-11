/**
 * Plugin de Acessibilidade — catálogo de recursos, perfis rápidos e preferências do usuário.
 *
 * Módulo PURO (sem DOM, sem banco, sem next/*): usado pelo painel (o que o cliente liga e a
 * prévia), pelo servidor (sanitização) e pelo SDK (sdk/accessibility/widget.ts), que aplica
 * as preferências na página. Uma regra, uma fonte.
 *
 * Vocabulário:
 *  - recurso (feature): uma ferramenta do painel ("Máscara de leitura", "Fonte legível").
 *    O cliente escolhe, no painel da Luumu, quais aparecem para os estudantes.
 *  - perfil rápido (profile): um atalho que liga vários recursos de uma vez ("Mais foco").
 *    Os nomes falam do benefício, não de diagnóstico: o estudante não precisa se rotular
 *    para usar ("Mais foco", e não "TDAH").
 *  - preferências (prefs): o estado escolhido pelo estudante, guardado no navegador dele.
 */

export const FEATURE_IDS = [
  "textSize",
  "readingMask",
  "readingGuide",
  "textReader",
  "legibleFont",
  "spacing",
  "contrast",
  "saturation",
  "colorBlind",
  "highlightLinks",
  "highlightHeadings",
  "bigCursor",
  "stopAnimations",
  "focusRing",
  "faceNav",
  "libras",
] as const;
export type FeatureId = (typeof FEATURE_IDS)[number];

export type FeatureGroup = "leitura" | "visual" | "navegacao" | "comunicacao";

export const FEATURE_GROUPS: { id: FeatureGroup; label: string }[] = [
  { id: "leitura", label: "Leitura" },
  { id: "visual", label: "Cores e contraste" },
  { id: "navegacao", label: "Navegação" },
  { id: "comunicacao", label: "Comunicação" },
];

export interface FeatureInfo {
  id: FeatureId;
  group: FeatureGroup;
  label: string;
  description: string;
  /** nome do ícone (o painel usa lucide; o SDK tem os próprios SVGs com o mesmo nome) */
  icon: string;
}

export const FEATURES: FeatureInfo[] = [
  { id: "textSize", group: "leitura", label: "Tamanho do texto", description: "Aumenta as letras da página", icon: "type" },
  { id: "readingMask", group: "leitura", label: "Máscara de leitura", description: "Escurece a tela e destaca só a linha em que você está", icon: "mask" },
  { id: "readingGuide", group: "leitura", label: "Guia de leitura", description: "Uma régua que acompanha o cursor", icon: "guide" },
  { id: "textReader", group: "leitura", label: "Leitor de texto", description: "Clique em um texto para ouvir", icon: "speaker" },
  { id: "legibleFont", group: "leitura", label: "Fonte legível", description: "Letras mais fáceis de diferenciar", icon: "font" },
  { id: "spacing", group: "leitura", label: "Espaçamento", description: "Mais espaço entre letras, palavras e linhas", icon: "spacing" },
  { id: "contrast", group: "visual", label: "Contraste", description: "Realça a diferença entre texto e fundo", icon: "contrast" },
  { id: "saturation", group: "visual", label: "Saturação", description: "Cores mais suaves, mais vivas ou em preto e branco", icon: "drop" },
  { id: "colorBlind", group: "visual", label: "Modo daltonismo", description: "Ajusta as cores para ficarem mais fáceis de distinguir", icon: "eye" },
  { id: "highlightLinks", group: "visual", label: "Destacar links", description: "Sublinha e realça tudo que é clicável", icon: "link" },
  { id: "highlightHeadings", group: "visual", label: "Destacar títulos", description: "Marca os títulos para achar as seções", icon: "heading" },
  { id: "bigCursor", group: "navegacao", label: "Cursor grande", description: "Um cursor maior e mais fácil de achar", icon: "cursor" },
  { id: "stopAnimations", group: "navegacao", label: "Pausar animações", description: "Para movimentos e efeitos da tela", icon: "pause" },
  { id: "focusRing", group: "navegacao", label: "Navegação por teclado", description: "Mostra com clareza onde está o foco ao usar Tab", icon: "keyboard" },
  { id: "faceNav", group: "navegacao", label: "Navegação por rosto", description: "Controle o cursor com movimentos da cabeça", icon: "face" },
  { id: "libras", group: "comunicacao", label: "Libras", description: "Tradutor VLibras (gov.br): clique num texto e um avatar traduz", icon: "hands" },
];

export const featureInfo = (id: FeatureId) => FEATURES.find((f) => f.id === id)!;

/* ------------------------------------------------------------------ preferências do usuário */

export const TEXT_SIZES = [100, 115, 130, 150, 175] as const;
export type ContrastMode = "off" | "high" | "dark";
export type SaturationMode = "off" | "low" | "high" | "mono";
export type ColorBlindMode = "off" | "protan" | "deutan" | "tritan";

export const CONTRAST_OPTIONS: { value: ContrastMode; label: string }[] = [
  { value: "off", label: "Normal" },
  { value: "high", label: "Alto" },
  { value: "dark", label: "Escuro" },
];
export const SATURATION_OPTIONS: { value: SaturationMode; label: string }[] = [
  { value: "off", label: "Normal" },
  { value: "low", label: "Baixa" },
  { value: "high", label: "Alta" },
  { value: "mono", label: "P&B" },
];
export const COLOR_BLIND_OPTIONS: { value: ColorBlindMode; label: string; hint: string }[] = [
  { value: "off", label: "Desligado", hint: "" },
  { value: "protan", label: "Protanopia", hint: "vermelho" },
  { value: "deutan", label: "Deuteranopia", hint: "verde" },
  { value: "tritan", label: "Tritanopia", hint: "azul" },
];

export interface A11yPrefs {
  /** índice em TEXT_SIZES (0 = 100%) */
  textSize: number;
  readingMask: boolean;
  readingGuide: boolean;
  textReader: boolean;
  legibleFont: boolean;
  spacing: boolean;
  contrast: ContrastMode;
  saturation: SaturationMode;
  colorBlind: ColorBlindMode;
  highlightLinks: boolean;
  highlightHeadings: boolean;
  bigCursor: boolean;
  stopAnimations: boolean;
  focusRing: boolean;
  libras: boolean;
  /** perfis rápidos ligados, na ordem em que foram ligados */
  profiles: ProfileId[];
}

/** Recursos que viram preferência guardada (a navegação por rosto usa a câmera: é só da sessão). */
export type PrefKey = Exclude<keyof A11yPrefs, "profiles">;

export const DEFAULT_PREFS: A11yPrefs = {
  textSize: 0,
  readingMask: false,
  readingGuide: false,
  textReader: false,
  legibleFont: false,
  spacing: false,
  contrast: "off",
  saturation: "off",
  colorBlind: "off",
  highlightLinks: false,
  highlightHeadings: false,
  bigCursor: false,
  stopAnimations: false,
  focusRing: false,
  libras: false,
  profiles: [],
};

/* ------------------------------------------------------------------------ perfis rápidos */

export const PROFILE_IDS = ["foco", "leitura", "ritmo", "visao", "cores", "calma", "ouvir", "libras"] as const;
export type ProfileId = (typeof PROFILE_IDS)[number];

export interface ProfileInfo {
  id: ProfileId;
  label: string;
  description: string;
  icon: string;
  /** para o painel da Luumu: a quem o perfil costuma ajudar (nunca aparece para o estudante) */
  audienceHint: string;
  preset: Partial<Omit<A11yPrefs, "profiles">>;
}

export const PROFILES: ProfileInfo[] = [
  {
    id: "foco",
    label: "Mais foco",
    description: "Máscara e guia de leitura",
    icon: "bolt",
    audienceHint: "TDAH e dificuldade de concentração",
    preset: { readingMask: true, readingGuide: true, stopAnimations: true },
  },
  {
    id: "leitura",
    label: "Mais conforto na leitura",
    description: "Texto maior, fonte legível e espaçamento",
    icon: "eye",
    audienceHint: "Dislexia e baixa visão leve",
    preset: { textSize: 2, legibleFont: true, spacing: true },
  },
  {
    id: "ritmo",
    label: "Uma navegação no seu ritmo",
    description: "Sem animações, links destacados e cursor maior",
    icon: "sliders",
    audienceHint: "Deficiência motora e TEA",
    preset: { stopAnimations: true, highlightLinks: true, bigCursor: true, focusRing: true },
  },
  {
    id: "visao",
    label: "Enxergar melhor",
    description: "Texto bem maior, alto contraste e títulos marcados",
    icon: "zoom",
    audienceHint: "Baixa visão",
    preset: { textSize: 3, contrast: "high", highlightLinks: true, highlightHeadings: true, bigCursor: true },
  },
  {
    id: "cores",
    label: "Cores fáceis de distinguir",
    description: "Ajuste de cores e links realçados",
    icon: "palette",
    audienceHint: "Daltonismo",
    preset: { colorBlind: "deutan", highlightLinks: true },
  },
  {
    id: "calma",
    label: "Tela mais calma",
    description: "Cores suaves e nada se mexendo",
    icon: "moon",
    audienceHint: "Epilepsia fotossensível e sensibilidade sensorial",
    preset: { saturation: "low", stopAnimations: true },
  },
  {
    id: "ouvir",
    label: "Ouvir o conteúdo",
    description: "Leitor de texto e foco visível",
    icon: "speaker",
    audienceHint: "Cegueira, baixa visão e dificuldade de leitura",
    preset: { textReader: true, focusRing: true },
  },
  {
    id: "libras",
    label: "Conteúdo em Libras",
    description: "Tradutor VLibras para os textos",
    icon: "hands",
    audienceHint: "Surdez e deficiência auditiva",
    preset: { libras: true },
  },
];

export const profileInfo = (id: ProfileId) => PROFILES.find((p) => p.id === id)!;
export const isProfileId = (v: unknown): v is ProfileId => typeof v === "string" && (PROFILE_IDS as readonly string[]).includes(v);
export const isFeatureId = (v: unknown): v is FeatureId => typeof v === "string" && (FEATURE_IDS as readonly string[]).includes(v);

/** Recurso do painel ao qual cada preferência pertence (para esconder perfis sem recurso). */
const PREF_FEATURE: Record<PrefKey, FeatureId> = {
  textSize: "textSize",
  readingMask: "readingMask",
  readingGuide: "readingGuide",
  textReader: "textReader",
  legibleFont: "legibleFont",
  spacing: "spacing",
  contrast: "contrast",
  saturation: "saturation",
  colorBlind: "colorBlind",
  highlightLinks: "highlightLinks",
  highlightHeadings: "highlightHeadings",
  bigCursor: "bigCursor",
  stopAnimations: "stopAnimations",
  focusRing: "focusRing",
  libras: "libras",
};

/** O preset do perfil, só com os recursos que o cliente deixou ligados. */
export function presetFor(id: ProfileId, enabled: Partial<Record<FeatureId, boolean>>): Partial<A11yPrefs> {
  const out: Partial<Record<PrefKey, unknown>> = {};
  for (const [k, v] of Object.entries(profileInfo(id).preset)) {
    if (enabled[PREF_FEATURE[k as PrefKey]] !== false) out[k as PrefKey] = v;
  }
  return out as Partial<A11yPrefs>;
}

/** Um perfil só faz sentido se ao menos um recurso dele estiver disponível. */
export function profileAvailable(id: ProfileId, enabled: Partial<Record<FeatureId, boolean>>): boolean {
  return Object.keys(presetFor(id, enabled)).length > 0;
}

/**
 * Liga ou desliga um perfil rápido.
 *
 * Ligar aplica o preset por cima do estado atual (o tamanho do texto só sobe, nunca desce).
 * Desligar devolve ao padrão as preferências do perfil, MENOS as que outro perfil ainda
 * ligado também define — desligar "Mais foco" não pode apagar o "Pausar animações" de
 * "Tela mais calma", que continua ligado.
 */
export function toggleProfile(prefs: A11yPrefs, id: ProfileId, enabled: Partial<Record<FeatureId, boolean>> = {}): A11yPrefs {
  const on = prefs.profiles.includes(id);
  const preset = presetFor(id, enabled);
  if (!on) {
    const next = { ...prefs, ...preset, profiles: [...prefs.profiles, id] };
    if (preset.textSize !== undefined) next.textSize = Math.max(prefs.textSize, preset.textSize);
    return next;
  }
  const remaining = prefs.profiles.filter((p) => p !== id);
  const next: A11yPrefs = { ...prefs, profiles: remaining };
  const kept: Partial<A11yPrefs> = {};
  for (const other of remaining) {
    const p = presetFor(other, enabled);
    for (const [k, v] of Object.entries(p)) {
      const key = k as PrefKey;
      // o tamanho que sobra é o maior entre os perfis ainda ligados
      if (key === "textSize") kept.textSize = Math.max(kept.textSize ?? 0, v as number);
      else (kept as Record<string, unknown>)[key] = v;
    }
  }
  for (const k of Object.keys(preset) as PrefKey[]) {
    (next as unknown as Record<string, unknown>)[k] = k in kept ? (kept as Record<string, unknown>)[k] : DEFAULT_PREFS[k];
  }
  return next;
}

/** Lê preferências guardadas (localStorage) aceitando só valores conhecidos. */
export function normalizePrefs(input: unknown): A11yPrefs {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const bool = (k: PrefKey) => (typeof o[k] === "boolean" ? (o[k] as boolean) : (DEFAULT_PREFS[k] as boolean));
  const pick = <T extends string>(k: PrefKey, allowed: readonly { value: T }[]) =>
    allowed.some((a) => a.value === o[k]) ? (o[k] as T) : (DEFAULT_PREFS[k] as T);
  const size = typeof o.textSize === "number" && Number.isInteger(o.textSize) ? o.textSize : 0;
  return {
    textSize: Math.min(TEXT_SIZES.length - 1, Math.max(0, size)),
    readingMask: bool("readingMask"),
    readingGuide: bool("readingGuide"),
    textReader: bool("textReader"),
    legibleFont: bool("legibleFont"),
    spacing: bool("spacing"),
    contrast: pick("contrast", CONTRAST_OPTIONS),
    saturation: pick("saturation", SATURATION_OPTIONS),
    colorBlind: pick("colorBlind", COLOR_BLIND_OPTIONS),
    highlightLinks: bool("highlightLinks"),
    highlightHeadings: bool("highlightHeadings"),
    bigCursor: bool("bigCursor"),
    stopAnimations: bool("stopAnimations"),
    focusRing: bool("focusRing"),
    libras: bool("libras"),
    profiles: Array.isArray(o.profiles) ? [...new Set(o.profiles.filter(isProfileId))] : [],
  };
}

/** Quantos ajustes estão ligados (selo no botão do launcher). */
export function activeCount(p: A11yPrefs): number {
  let n = p.textSize > 0 ? 1 : 0;
  for (const k of Object.keys(DEFAULT_PREFS) as (keyof A11yPrefs)[]) {
    if (k === "textSize" || k === "profiles") continue;
    if (p[k] !== DEFAULT_PREFS[k]) n++;
  }
  return n;
}

/* ------------------------------------------------------------------- correção de daltonismo */

type M3 = [number, number, number, number, number, number, number, number, number];

// simulação de cada tipo de daltonismo (matrizes lineares RGB clássicas)
const SIMULATION: Record<Exclude<ColorBlindMode, "off">, M3> = {
  protan: [0.567, 0.433, 0, 0.558, 0.442, 0, 0, 0.242, 0.758],
  deutan: [0.625, 0.375, 0, 0.7, 0.3, 0, 0, 0.3, 0.7],
  tritan: [0.95, 0.05, 0, 0, 0.433, 0.567, 0, 0.475, 0.525],
};
// para onde vai a informação que a pessoa não enxerga (daltonização)
const SHIFT: Record<Exclude<ColorBlindMode, "off">, M3> = {
  protan: [0, 0, 0, 0.7, 1, 0, 0.7, 0, 1],
  deutan: [0, 0, 0, 0.7, 1, 0, 0.7, 0, 1],
  tritan: [1, 0, 0.7, 0, 1, 0.7, 0, 0, 0],
};

function mul(a: M3, b: M3): M3 {
  const r = new Array(9).fill(0) as M3;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
  return r;
}

/**
 * Matriz de correção (daltonização): C = I + SHIFT · (I − SIM). A diferença entre a cor real e
 * a percebida é redistribuída para os canais que a pessoa enxerga. Devolve os 20 valores do
 * `<feColorMatrix type="matrix">` (4×5, alfa intacto).
 */
export function colorBlindMatrix(mode: Exclude<ColorBlindMode, "off">): number[] {
  const I: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const err = I.map((v, i) => v - SIMULATION[mode][i]) as M3;
  const c = mul(SHIFT[mode], err).map((v, i) => I[i] + v);
  const r = (n: number) => Math.round(n * 1000) / 1000;
  return [r(c[0]), r(c[1]), r(c[2]), 0, 0, r(c[3]), r(c[4]), r(c[5]), 0, 0, r(c[6]), r(c[7]), r(c[8]), 0, 0, 0, 0, 0, 1, 0];
}
