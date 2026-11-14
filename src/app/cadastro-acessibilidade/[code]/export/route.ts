import { readCadastroCsv } from "@/lib/accessibility/cadastro-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /cadastro-acessibilidade/:código/export?format=csv
 * O CSV gerado pela página de cadastro, no mesmo formato do export do Google Planilhas.
 * Vale por 7 dias (o código traz a validade); depois responde 410.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const csv = await readCadastroCsv(code);
  const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex", "Access-Control-Allow-Origin": "*" };
  if (csv === "expired") return new Response("Este link venceu. Gere um novo em luumu.com.br/cadastro-acessibilidade.\n", { status: 410, headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" } });
  if (csv === null) return new Response("Link não encontrado.\n", { status: 404, headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" } });
  return new Response(csv, {
    headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="cadastro-acessibilidade.csv"' },
  });
}
