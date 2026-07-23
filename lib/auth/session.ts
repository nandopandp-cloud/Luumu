import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const COOKIE = "luumu_session";
const secretStr = process.env.AUTH_SECRET;
if (!secretStr) throw new Error("AUTH_SECRET não configurada.");
const secret = new TextEncoder().encode(secretStr);

export interface SessionData {
  userId: string;
  workspaceId: string;
  email: string;
  name: string;
}

/** Assina um JWT com os dados da sessão e grava no cookie httpOnly. */
export async function createSession(data: SessionData) {
  const token = await new SignJWT({ ...data })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

/** Lê e valida a sessão do cookie (ou null). */
export async function getSession(): Promise<SessionData | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      userId: String(payload.userId),
      workspaceId: String(payload.workspaceId),
      email: String(payload.email),
      name: String(payload.name),
    };
  } catch {
    return null;
  }
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE);
}

/** Verifica um token JWT sem depender de cookies (usado no middleware/edge). */
export async function verifyToken(token: string): Promise<SessionData | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      userId: String(payload.userId),
      workspaceId: String(payload.workspaceId),
      email: String(payload.email),
      name: String(payload.name),
    };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = COOKIE;
