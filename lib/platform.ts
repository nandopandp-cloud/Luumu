import "server-only";
import { cookies } from "next/headers";
import { normalizeHosts } from "@/lib/hosts";

/*
  Plataforma escolhida no seletor do header, herdada por todas as jornadas do produto. Guardada
  num cookie por projeto ("<projeto>|<host>,<host>"): trocar de projeto volta para "Todas". O ?host= da
  URL vem primeiro — um link compartilhado abre na plataforma de quem o enviou.
*/
export const PLATFORM_COOKIE = "luumu_platform";

/** Plataformas salvas para o projeto ("a,b"; "" = todas). */
export async function savedPlatform(projectId: string): Promise<string> {
  const raw = (await cookies()).get(PLATFORM_COOKIE)?.value ?? "";
  const [pid, host] = decodeURIComponent(raw).split("|");
  return pid === projectId ? normalizeHosts(host) : "";
}

/** Plataforma desta tela: a da URL, senão a escolhida no header. undefined = todas. */
export async function selectedPlatform(projectId: string, urlHost?: string | null): Promise<string | undefined> {
  return normalizeHosts(urlHost) || (await savedPlatform(projectId)) || undefined;
}
