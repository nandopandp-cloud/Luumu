import { NextResponse } from "next/server";

/** Headers CORS abertos para os endpoints públicos do SDK. */
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

/** Resposta JSON com CORS. */
export function jsonCors(data: unknown, init?: { status?: number }) {
  return NextResponse.json(data, { status: init?.status ?? 200, headers: corsHeaders });
}

/** Handler padrão para preflight OPTIONS. */
export function preflight() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}
