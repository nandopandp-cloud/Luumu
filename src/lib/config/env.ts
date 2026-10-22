/**
 * URL pública base do app (sem barra no fim), usada para montar links absolutos em
 * contextos sem `request` (e-mails, jobs). Prioriza NEXT_PUBLIC_APP_URL (configurável
 * explicitamente), cai para o domínio do deploy da Vercel, e por fim localhost em dev.
 */
export function getAppOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;

  return "http://localhost:3000";
}
