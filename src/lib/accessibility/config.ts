/**
 * Plugin de Acessibilidade — configuração por projeto (o que se edita no painel da Luumu).
 *
 * Módulo PURO. `normalizeA11yConfig` é a ÚNICA porta de entrada: o painel, a server action e
 * o /config passam por ela, então um campo novo com valor ausente ou inválido cai no padrão
 * em vez de quebrar o SDK nos sites dos clientes.
 *
 * `publicA11yConfig` é o recorte que vai para o navegador do estudante (/config). A lista de
 * convidados não faz parte da configuração: mora em accessibility_invitees e o navegador só
 * sabe se ela existe (ver audience.ts, "Privacidade").
 */
import { FEATURE_IDS, PROFILE_IDS, isProfileId, type FeatureId, type ProfileId } from "./features";
import { normalizeGroups, type AudienceGroup } from "./audience";
import { DEFAULT_SCOPE, normalizeScope, type ActivationScope } from "./scope";
import { HAIR_COLORS, SKIN_TONES, VLIBRAS_AVATARS, safePersonalizationUrl, type VlibrasAvatar, type VlibrasLook } from "./vlibras";

export type LauncherPosition = "bottom-right" | "bottom-left" | "middle-right" | "middle-left";
export type PanelTheme = "light" | "dark" | "auto";
export type NudgeFrequency = "once" | "until_accepted" | "every_session";
/**
 * Libras pelo VLibras (lib/accessibility/vlibras.ts). `personalizationUrl` só é preenchido
 * depois que o VLibras aprova a parceria; as cores e a logo abaixo servem para montar o pedido.
 */
export interface LibrasConfig {
  avatar: VlibrasAvatar;
  personalizationUrl: string;
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  /** "none" = camisa lisa; "brand" = logo do painel (brand.logoUrl); "custom" = logoUrl abaixo */
  logo: "none" | "brand" | "custom";
  logoUrl: string;
  logoPosition: "center" | "chest";
}

export interface NudgeConfig {
  enabled: boolean;
  /** "all" = todo estudante com o plugin; "targeted" = só grupos e/ou convidados da lista */
  audience: "all" | "targeted";
  groups: AudienceGroup[];
  title: string;
  message: string;
  cta: string;
  dismiss: string;
  /** perfil sugerido no convite (null = só abre o painel) */
  profile: ProfileId | null;
  frequency: NudgeFrequency;
  /** segundos depois do carregamento da página */
  delay: number;
}

export interface A11yConfig {
  /** onde o plugin fica ativo (lib/accessibility/scope.ts) */
  scope: ActivationScope;
  brand: {
    title: string;
    subtitle: string;
    accent: string;
    logoUrl: string;
    theme: PanelTheme;
  };
  launcher: {
    position: LauncherPosition;
    label: string;
    /** rótulos sempre visíveis (senão aparecem ao passar o mouse/foco) */
    showLabels: boolean;
    librasShortcut: boolean;
    faceShortcut: boolean;
    /** distância da borda inferior em px (para não cobrir o chat do produto) */
    offset: number;
  };
  features: Record<FeatureId, boolean>;
  profiles: ProfileId[];
  libras: LibrasConfig;
  nudge: NudgeConfig;
}

/** O que o SDK recebe: sem os domínios (filtrados no servidor) e sabendo só se há convidados. */
export type PublicA11yConfig = Omit<A11yConfig, "nudge" | "scope"> & {
  scope: Omit<ActivationScope, "hosts">;
  nudge: NudgeConfig & { hasList: boolean };
};

export const LAUNCHER_POSITIONS: { value: LauncherPosition; label: string }[] = [
  { value: "bottom-right", label: "Inferior direito" },
  { value: "middle-right", label: "Meio à direita" },
  { value: "bottom-left", label: "Inferior esquerdo" },
  { value: "middle-left", label: "Meio à esquerda" },
];

export const NUDGE_FREQUENCIES: { value: NudgeFrequency; label: string; hint: string }[] = [
  { value: "once", label: "Uma vez", hint: "Aparece no primeiro acesso e não volta" },
  { value: "until_accepted", label: "Até aceitar", hint: "Volta a cada 7 dias enquanto o estudante não ativar" },
  { value: "every_session", label: "A cada acesso", hint: "Uma vez por sessão, enquanto nada estiver ativo" },
];

export const ACCENT_PRESETS = ["#4F46E5", "#6B2BD9", "#0E7490", "#0F766E", "#15803D", "#B45309", "#BE123C", "#111827"];

export const DEFAULT_A11Y_CONFIG: A11yConfig = {
  scope: DEFAULT_SCOPE,
  brand: {
    title: "Acessibilidade",
    subtitle: "Ajuste a plataforma do seu jeito. Suas escolhas ficam salvas na sua conta.",
    accent: "#4F46E5",
    logoUrl: "",
    theme: "light",
  },
  launcher: {
    position: "bottom-right",
    label: "Acessibilidade",
    showLabels: false,
    librasShortcut: true,
    faceShortcut: true,
    offset: 24,
  },
  features: Object.fromEntries(FEATURE_IDS.map((f) => [f, true])) as Record<FeatureId, boolean>,
  profiles: ["foco", "leitura", "ritmo", "visao", "calma", "libras"],
  libras: {
    avatar: "icaro",
    personalizationUrl: "",
    skin: SKIN_TONES[2].value,
    hair: HAIR_COLORS[0].value,
    shirt: "#1A1A1A",
    pants: "#201E62",
    logo: "brand",
    logoUrl: "",
    logoPosition: "chest",
  },
  nudge: {
    enabled: false,
    audience: "targeted",
    groups: [],
    title: "Sua experiência pode ficar ainda melhor",
    message: "Separamos recursos de acessibilidade que deixam a leitura e a navegação mais confortáveis. Quer experimentar?",
    cta: "Ativar recursos",
    dismiss: "Agora não",
    profile: null,
    frequency: "until_accepted",
    delay: 2,
  },
};

const HEX = /^#[0-9a-f]{6}$/i;
const color = (v: unknown, fallback: string) => (typeof v === "string" && HEX.test(v.trim()) ? v.trim().toUpperCase() : fallback);
const text = (v: unknown, fallback: string, max: number) => {
  if (typeof v !== "string") return fallback;
  const t = v.replace(/\s+/g, " ").trim().slice(0, max);
  return t || fallback;
};
// texto que pode ficar vazio de propósito (ex.: subtítulo)
const optText = (v: unknown, fallback: string, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : fallback);
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;
/** Só https (ou caminho do próprio site): a imagem aparece no produto do cliente. */
export function safeImageUrl(v: unknown): string {
  if (typeof v !== "string") return "";
  const s = v.trim();
  if (/^https:\/\/[^\s"'<>]+$/i.test(s) && s.length <= 500) return s;
  if (/^\/[\w\-./]+$/.test(s) && s.length <= 200) return s;
  return "";
}
const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export function normalizeA11yConfig(input: unknown): A11yConfig {
  const d = DEFAULT_A11Y_CONFIG;
  const o = obj(input);
  const brand = obj(o.brand);
  const launcher = obj(o.launcher);
  const features = obj(o.features);
  const libras = obj(o.libras);
  const nudge = obj(o.nudge);

  const profiles = Array.isArray(o.profiles) ? [...new Set(o.profiles.filter(isProfileId))] : d.profiles;
  const delay = typeof nudge.delay === "number" && Number.isFinite(nudge.delay) ? Math.round(Math.min(30, Math.max(0, nudge.delay))) : d.nudge.delay;
  const offset = typeof launcher.offset === "number" && Number.isFinite(launcher.offset) ? Math.round(Math.min(200, Math.max(8, launcher.offset))) : d.launcher.offset;

  return {
    scope: normalizeScope(o.scope),
    brand: {
      title: text(brand.title, d.brand.title, 40),
      subtitle: optText(brand.subtitle, d.brand.subtitle, 160),
      accent: color(brand.accent, d.brand.accent),
      logoUrl: safeImageUrl(brand.logoUrl),
      theme: oneOf(brand.theme, ["light", "dark", "auto"] as const, d.brand.theme),
    },
    launcher: {
      position: oneOf(launcher.position, LAUNCHER_POSITIONS.map((p) => p.value), d.launcher.position),
      label: text(launcher.label, d.launcher.label, 30),
      showLabels: bool(launcher.showLabels, d.launcher.showLabels),
      librasShortcut: bool(launcher.librasShortcut, d.launcher.librasShortcut),
      faceShortcut: bool(launcher.faceShortcut, d.launcher.faceShortcut),
      offset,
    },
    features: Object.fromEntries(FEATURE_IDS.map((f) => [f, bool(features[f], d.features[f])])) as Record<FeatureId, boolean>,
    profiles: profiles.filter((p) => (PROFILE_IDS as readonly string[]).includes(p)),
    libras: {
      avatar: oneOf(libras.avatar, VLIBRAS_AVATARS.map((a) => a.value), d.libras.avatar),
      personalizationUrl: safePersonalizationUrl(libras.personalizationUrl),
      skin: color(libras.skin, d.libras.skin),
      hair: color(libras.hair, d.libras.hair),
      shirt: color(libras.shirt, d.libras.shirt),
      pants: color(libras.pants, d.libras.pants),
      logo: oneOf(libras.logo, ["none", "brand", "custom"] as const, d.libras.logo),
      logoUrl: safeImageUrl(libras.logoUrl),
      logoPosition: oneOf(libras.logoPosition, ["center", "chest"] as const, d.libras.logoPosition),
    },
    nudge: {
      enabled: bool(nudge.enabled, d.nudge.enabled),
      audience: oneOf(nudge.audience, ["all", "targeted"] as const, d.nudge.audience),
      groups: normalizeGroups(nudge.groups),
      title: text(nudge.title, d.nudge.title, 80),
      message: text(nudge.message, d.nudge.message, 280),
      cta: text(nudge.cta, d.nudge.cta, 30),
      dismiss: text(nudge.dismiss, d.nudge.dismiss, 30),
      profile: isProfileId(nudge.profile) ? nudge.profile : null,
      frequency: oneOf(nudge.frequency, NUDGE_FREQUENCIES.map((f) => f.value), d.nudge.frequency),
      delay,
    },
  };
}

/** Recorte para o navegador. `hasInvitees`: o projeto tem convidados na lista (contagem do banco). */
export function publicA11yConfig(config: A11yConfig, hasInvitees = false): PublicA11yConfig {
  const { hosts: _hosts, ...scope } = config.scope;
  void _hosts;
  return { ...config, scope, nudge: { ...config.nudge, hasList: hasInvitees } };
}

/** Logo que vai na camisa do avatar (vazio = camisa lisa). */
export function librasLogoUrl(config: Pick<A11yConfig, "libras" | "brand">): string {
  if (config.libras.logo === "brand") return config.brand.logoUrl;
  if (config.libras.logo === "custom") return config.libras.logoUrl;
  return "";
}

/** Cores e logo desejadas, no formato do pedido ao VLibras. */
export function librasLook(config: Pick<A11yConfig, "libras" | "brand">): VlibrasLook {
  const l = config.libras;
  return { skin: l.skin, hair: l.hair, shirt: l.shirt, pants: l.pants, logoUrl: librasLogoUrl(config), logoPosition: l.logoPosition };
}

/** Texto legível sobre a cor de destaque (preto ou branco, pelo contraste WCAG). */
export function readableOn(hex: string): "#FFFFFF" | "#111827" {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  // contraste com branco vs. com quase-preto (#111827, L≈0.0123)
  return (1.05 / (L + 0.05)) >= ((L + 0.05) / 0.0623) ? "#FFFFFF" : "#111827";
}

/** Escurece (amt < 0) ou clareia (amt > 0) uma cor #RRGGBB. */
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const f = (c: number) => Math.round(Math.min(255, Math.max(0, amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
