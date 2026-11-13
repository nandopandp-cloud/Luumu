import { NextResponse } from "next/server";
import { cacheableCorsHeaders, jsonCors, preflight } from "@/lib/api/cors";
import { checkRateLimit } from "@/lib/api/ratelimit";
import { safeGloss, signFromBundle } from "@/lib/accessibility/libras3d/sign";

export const runtime = "nodejs";

export function OPTIONS(req: Request) {
  return preflight(req.headers.get("origin"));
}

const DICTIONARY = "https://dicionario2.vlibras.gov.br/2018.3.1/WEBGL/";
const MONTH = "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800";
const MISSING = "public, max-age=3600, s-maxage=86400";

/**
 * GET /api/v1/accessibility/libras/sinal/:glosa
 * Um sinal do dicionário oficial do VLibras convertido para o intérprete 3D da Luumu
 * (lib/accessibility/libras3d/sign.ts). Público e igual para todos: a resposta fica 30 dias na
 * borda, então cada palavra é convertida uma vez. Palavra sem sinal → 200 com `missing: true` (o
 * intérprete soletra; um 404 sujaria o console do site do cliente a cada nome próprio).
 */
export async function GET(req: Request, { params }: { params: Promise<{ gloss: string }> }) {
  const gloss = safeGloss(decodeURIComponent((await params).gloss));
  if (!gloss) return jsonCors({ error: "Glosa inválida." }, { status: 400, cache: MISSING });

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "anon";
  if (!(await checkRateLimit(`libras-sinal:${ip}`, 300, 60))) {
    return NextResponse.json({ error: "Muitas requisições." }, { status: 429, headers: { ...cacheableCorsHeaders(), "Cache-Control": "no-store" } });
  }

  let res: Response;
  try {
    res = await fetch(DICTIONARY + encodeURIComponent(gloss), { signal: AbortSignal.timeout(8000), redirect: "follow" });
  } catch {
    return jsonCors({ error: "Dicionário do VLibras indisponível." }, { status: 502, cache: "no-store" });
  }
  if (res.status === 404) return jsonCors({ gloss, missing: true }, { cache: MISSING });
  if (!res.ok) return jsonCors({ error: "Dicionário do VLibras indisponível." }, { status: 502, cache: "no-store" });

  try {
    const bundle = new Uint8Array(await res.arrayBuffer());
    if (bundle.length > 2_000_000) throw new Error("grande demais");
    return jsonCors({ gloss, ...signFromBundle(bundle) }, { cache: MONTH });
  } catch {
    return jsonCors({ error: "Não foi possível ler este sinal.", gloss }, { status: 422, cache: MISSING });
  }
}
