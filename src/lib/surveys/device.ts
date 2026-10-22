/*
  Tipo de dispositivo de quem respondeu. PURO: usado pelo SDK (no navegador do usuário), pela
  página pública de pesquisa e, como plano B, pelo servidor a partir do User-Agent.
*/
export const DEVICE_KINDS = ["mobile", "tablet", "desktop"] as const;
export type DeviceKind = (typeof DEVICE_KINDS)[number];

/**
 * `touchPoints` (navigator.maxTouchPoints) desempata o iPad, que desde o iPadOS 13 se
 * apresenta como "Macintosh" no User-Agent. Sem ele (servidor), um iPad nesse modo conta
 * como desktop — por isso o valor enviado pelo navegador tem prioridade.
 */
export function detectDevice(ua: string | null | undefined, touchPoints = 0): DeviceKind {
  const s = ua ?? "";
  if (/iPad|Tablet|PlayBook|Silk|Kindle|Nexus (7|9|10)|SM-T\d/i.test(s)) return "tablet";
  if (/Android/i.test(s) && !/Mobile/i.test(s)) return "tablet";
  if (/Macintosh/i.test(s) && touchPoints > 1) return "tablet";
  if (/Mobi|iPhone|iPod|Android|Windows Phone|BlackBerry|Opera Mini/i.test(s)) return "mobile";
  return "desktop";
}

export function isDeviceKind(v: unknown): v is DeviceKind {
  return typeof v === "string" && (DEVICE_KINDS as readonly string[]).includes(v);
}

export const DEVICE_LABEL: Record<DeviceKind, string> = { mobile: "Celular", tablet: "Tablet", desktop: "Desktop" };
