/**
 * Destino pós-login (puro): só caminho interno de rota protegida. `next` vem da URL (entrada do
 * usuário), então "//evil.com" e URLs absolutas são descartadas para não virar open redirect.
 * Usado pelo login com senha e pelo login com Google.
 */

/**
 * Rotas protegidas às quais o login pode devolver o usuário (espelha PROTECTED do proxy.ts).
 * As áreas de LOCKED_ROUTES ficam de fora: o proxy as devolveria para /dashboard.
 */
const NEXT_ALLOWED = [
  "/dashboard", "/surveys", "/responses", "/reports", "/sdk", "/settings", "/tours", "/insights", "/billing", "/heatmaps", "/help", "/analytics", "/product-report", "/accessibility", "/notifications",
];

export function safeNext(raw: unknown): string {
  const next = typeof raw === "string" ? raw : "";
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return "/dashboard";
  return NEXT_ALLOWED.some((p) => next === p || next.startsWith(p + "/") || next.startsWith(p + "?")) ? next : "/dashboard";
}
