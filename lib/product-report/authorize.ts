/**
 * Regra de acesso do Report Quinzenal de Produto, sem dependências de Next/banco (testável).
 * O guard usado pelas páginas e APIs do módulo fica em ./access.ts.
 */

/** Única conta autorizada a ver e usar o módulo. */
export const PRODUCT_REPORT_EMAIL = "nandopandp@gmail.com";

export type ProductReportUserLookup = (userId: string) => Promise<{ id: string; email: string } | null>;

/**
 * True só se a sessão pertence à conta autorizada.
 *
 * O e-mail comparado é o do BANCO, lido pelo userId da sessão (JWT assinado com AUTH_SECRET),
 * nunca o e-mail que vem no token ou em qualquer entrada do cliente: conta removida perde o
 * acesso na hora, e nenhum claim fora do userId decide nada.
 *
 * `pinnedUserId` (env PRODUCT_REPORT_USER_ID, opcional) amarra o acesso também ao id da conta.
 * Fecha a brecha do convite: admins de qualquer workspace criam contas com o e-mail que quiserem,
 * sem confirmação de posse, então se a conta autorizada for apagada e recriada por outra pessoa,
 * o id muda e o acesso não acompanha.
 */
export async function isProductReportUser(
  session: { userId: string } | null | undefined,
  lookup: ProductReportUserLookup,
  pinnedUserId: string | undefined = process.env.PRODUCT_REPORT_USER_ID
): Promise<boolean> {
  if (!session?.userId) return false;
  if (pinnedUserId && session.userId !== pinnedUserId) return false;
  const user = await lookup(session.userId);
  if (!user || user.id !== session.userId) return false;
  return user.email.trim().toLowerCase() === PRODUCT_REPORT_EMAIL;
}
