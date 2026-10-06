import { normalizeHost } from "@/lib/hosts";
import type { Rule, TourSettings, TourStep } from "./types";

/*
  Troca de plataforma na duplicação. Além de `targetHosts`, os endereços absolutos que apontam
  para a plataforma de ORIGEM (URL inicial do builder, links de ação dos passos) passam a
  apontar para a de destino — senão o builder abriria o produto antigo e o botão "Ir para..."
  levaria o usuário para fora. Só reescreve com UM destino (com vários, não há qual escolher)
  e só URLs cujo host é uma origem conhecida: imagens no Blob e links externos ficam intactos.
  Rotas e seletores não mudam; plataformas irmãs costumam compartilhar o front, mas vale
  revisar os passos no builder antes de publicar.
*/
export function retargetHosts(settings: TourSettings, steps: TourStep[], targetHosts: string[]) {
  const to = targetHosts.length === 1 ? targetHosts[0] : null;
  const from = new Set(settings.targetHosts);
  const startHost = hostOf(settings.startUrl);
  if (startHost) from.add(startHost);
  if (to) from.delete(to);

  const swap = (url: string) => {
    if (!to || !from.size) return url;
    try {
      const u = new URL(url);
      if (!from.has(u.hostname)) return url;
      u.hostname = to;
      return u.toString();
    } catch {
      return url;
    }
  };

  // regra "plataforma = origem" esconderia a cópia justamente no destino
  const swapRules = (rules: Rule[]) =>
    rules.map((r) => (to && r.field === "host" && r.value && from.has(normalizeHost(r.value)) ? { ...r, value: to } : r));

  return {
    settings: {
      ...settings,
      targetHosts,
      startUrl: settings.startUrl ? swap(settings.startUrl) : settings.startUrl,
      audience: { ...settings.audience, rules: swapRules(settings.audience.rules) },
    },
    steps: steps.map((s) => ({
      ...s,
      action: s.action.type === "open_url" && s.action.value ? { ...s.action, value: swap(s.action.value) } : s.action,
      conditions: swapRules(s.conditions),
    })),
  };
}

const hostOf = (url: string) => {
  try {
    return url ? new URL(url).hostname : null;
  } catch {
    return null;
  }
};
