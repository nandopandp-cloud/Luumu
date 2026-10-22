import "server-only";
import { resolveKey } from "@/lib/api/keys";
import { hostFromOrigin } from "@/lib/db/hosts";
import { verifyTourToken, type TourTokenData, type TourTokenMode } from "./token";

/**
 * Autoriza uma chamada do overlay do builder (ou do preview) feita de dentro do produto do
 * cliente. Exige as duas coisas:
 *  - token válido do modo pedido (quem é o administrador e qual tour ele pode mexer);
 *  - SDK key do MESMO projeto do token (o site onde o overlay roda é mesmo deste projeto).
 * Sem a segunda, um token vazado poderia ser usado a partir de qualquer site.
 */
export async function authorizeTourToken(
  token: unknown,
  key: unknown,
  origin: string | null,
  mode: TourTokenMode
): Promise<{ ok: true; data: TourTokenData; host: string } | { ok: false; status: number; error: string }> {
  const data = await verifyTourToken(token, mode);
  if (!data) return { ok: false, status: 401, error: "Sessão do builder expirada. Abra o produto de novo pelo painel." };
  const resolved = await resolveKey(typeof key === "string" ? key : null);
  if (!resolved || resolved.projectId !== data.projectId) {
    return { ok: false, status: 403, error: "Este site usa a chave de outro projeto." };
  }
  return { ok: true, data, host: hostFromOrigin(origin) };
}
