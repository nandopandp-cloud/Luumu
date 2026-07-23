/**
 * Rotas do app ainda sem fonte de dados real — bloqueadas na sidebar e no proxy.
 * Fonte da verdade única; NAV (components/shell/nav.ts) e proxy.ts leem daqui.
 */
export const LOCKED_ROUTES = ["/heatmaps", "/replay", "/analytics", "/insights"] as const;

export function isLockedPath(pathname: string): boolean {
  return LOCKED_ROUTES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
