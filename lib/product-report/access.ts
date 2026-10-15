import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current";
import { getSession } from "@/lib/auth/session";
import { getUserById } from "@/lib/db/users";
import { isProductReportUser } from "./authorize";

/** Guard das rotas de API do módulo: a sessão da conta autorizada, ou null (a rota responde 404). */
export async function productReportApiSession() {
  const session = await getSession();
  return session && (await isProductReportUser(session, getUserById)) ? session : null;
}

/**
 * Guard das páginas e server actions do módulo: sem sessão vai para o login; sessão de outra
 * conta recebe 404 (a rota não se anuncia a quem não pode usá-la). Chame em TODA operação do
 * módulo — layout, page, action e rota de API —, não só na entrada.
 */
export async function requireProductReportAccess() {
  const session = await requireUser();
  if (!(await isProductReportUser(session, getUserById))) notFound();
  return session;
}
