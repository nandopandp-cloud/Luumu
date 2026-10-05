import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { avatarSvgs } from "@/db/schema";

/*
  GET /api/v1/avatars/<projeto>/<impressão>.svg — avatar desenhado em SVG embutido, copiado pelo
  SDK da tela do produto. O conteúdo de uma impressão nunca muda: cache de 1 ano na CDN (a função
  roda uma vez por desenho). Já foi limpo ao gravar; ainda assim vai com CSP "sandbox" e sem
  sniffing, para nada executar nem se aberto direto no navegador.
*/
const HEADERS = {
  "Content-Type": "image/svg+xml; charset=utf-8",
  "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(_req: Request, { params }: { params: Promise<{ project: string; file: string }> }) {
  const { project, file } = await params;
  const hash = /^([0-9a-f]{16})\.svg$/.exec(file)?.[1];
  if (!hash || !/^[A-Za-z0-9_-]{1,64}$/.test(project)) return new Response("Não encontrado.", { status: 404 });
  const [row] = await db
    .select({ svg: avatarSvgs.svg })
    .from(avatarSvgs)
    .where(and(eq(avatarSvgs.projectId, project), eq(avatarSvgs.hash, hash)))
    .limit(1)
    .catch(() => []);
  if (!row) return new Response("Não encontrado.", { status: 404, headers: { "Cache-Control": "public, s-maxage=60" } });
  return new Response(row.svg, { headers: HEADERS });
}
