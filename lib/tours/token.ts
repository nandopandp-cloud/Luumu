import "server-only";
import { SignJWT, jwtVerify } from "jose";

/*
  Token que leva o modo builder/preview para dentro do produto do cliente
  (?luumu_builder=<token> / ?luumu_preview=<token>).

  Assinado com o mesmo AUTH_SECRET da sessão, mas com `aud` próprio: um token de builder não
  vale como sessão do painel e vice-versa. Dá acesso SÓ ao tour indicado, do projeto indicado,
  e expira (4h no builder, 2h no preview). Viaja na URL e fica no sessionStorage da aba do
  administrador — por isso não carrega nada além de ids.
*/

const secretStr = process.env.AUTH_SECRET;
if (!secretStr) throw new Error("AUTH_SECRET não configurada.");
const secret = new TextEncoder().encode(secretStr);
const AUDIENCE = "luumu-tours";

export type TourTokenMode = "builder" | "preview";

export interface TourTokenData {
  mode: TourTokenMode;
  workspaceId: string;
  projectId: string;
  tourId: string;
  userId: string;
  /** builder: passo cujo alvo será trocado; preview: passo inicial */
  stepKey?: string;
}

export async function signTourToken(data: TourTokenData): Promise<string> {
  return new SignJWT({ m: data.mode, w: data.workspaceId, p: data.projectId, t: data.tourId, u: data.userId, s: data.stepKey })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(data.mode === "builder" ? "4h" : "2h")
    .sign(secret);
}

export async function verifyTourToken(token: unknown, mode: TourTokenMode): Promise<TourTokenData | null> {
  if (typeof token !== "string" || token.length > 2000) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { audience: AUDIENCE });
    if (payload.m !== mode) return null;
    const ids = [payload.w, payload.p, payload.t, payload.u];
    if (!ids.every((v) => typeof v === "string" && v)) return null;
    return {
      mode,
      workspaceId: payload.w as string,
      projectId: payload.p as string,
      tourId: payload.t as string,
      userId: payload.u as string,
      stepKey: typeof payload.s === "string" ? payload.s : undefined,
    };
  } catch {
    return null;
  }
}
