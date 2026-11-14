import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/api/ratelimit";
import { CADASTRO_TTL_DAYS, convertCadastro, googleSheetCsvUrl, parseCsv, toCsv, CADASTRO_COLUMNS } from "@/lib/accessibility/cadastro";
import { cadastroStorageReady, readXlsx, saveCadastroCsv } from "@/lib/accessibility/cadastro-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_BYTES = 5 * 1024 * 1024;
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

/**
 * POST /api/cadastro-acessibilidade  (multipart: "link" do Google Planilhas OU "file" .csv/.xlsx)
 * Lê a planilha-modelo, converte "Perfis do convite" (TDAH → foco…) e devolve o link do CSV
 * pronto para a plataforma externa, válido por 7 dias (lib/accessibility/cadastro.ts).
 * Página aberta: limite por IP, só a planilha-modelo é aceita e o arquivo expira.
 */
export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "anon";
  if (!(await checkRateLimit(`cadastro-a11y:${ip}`, 30, 3600))) return fail("Muitos envios em pouco tempo. Tente de novo em alguns minutos.", 429);
  if (!cadastroStorageReady()) return fail("O cadastro ainda não está configurado (armazenamento de arquivos).", 503);

  const form = await req.formData().catch(() => null);
  if (!form) return fail("Envio inválido.");
  const link = form.get("link");
  const file = form.get("file");

  let table: string[][];
  if (typeof link === "string" && link.trim()) {
    const url = googleSheetCsvUrl(link);
    if (!url) return fail("Esse link não é do Google Planilhas.");
    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(15_000), redirect: "follow" });
    } catch {
      return fail("O Google Planilhas não respondeu. Tente de novo.", 502);
    }
    const type = res.headers.get("content-type") || "";
    if (!res.ok || !/text\/csv|text\/plain|octet-stream/.test(type)) {
      return fail("Não conseguimos abrir a planilha. Compartilhe como “Qualquer pessoa com o link pode ver” e tente de novo.");
    }
    const text = await res.text();
    if (text.length > MAX_BYTES) return fail("A planilha é grande demais (máx. 5 MB).", 413);
    table = parseCsv(text);
  } else if (file instanceof File) {
    if (file.size > MAX_BYTES) return fail("Arquivo grande demais (máx. 5 MB).", 413);
    const name = file.name.toLowerCase();
    try {
      if (name.endsWith(".csv")) table = parseCsv(new TextDecoder("utf-8").decode(await file.arrayBuffer()));
      else if (name.endsWith(".xlsx")) table = await readXlsx(await file.arrayBuffer());
      else return fail("Envie um arquivo .csv ou .xlsx.", 415);
    } catch {
      return fail("Não conseguimos ler o arquivo. Salve de novo como .xlsx ou .csv e tente outra vez.");
    }
  } else {
    return fail("Cole o link do Google Planilhas ou escolha um arquivo.");
  }

  const result = convertCadastro(table);
  if (!result.ok) return fail(result.error, 422);

  let code: string;
  try {
    code = await saveCadastroCsv(toCsv([[...CADASTRO_COLUMNS], ...result.rows]));
  } catch {
    return fail("Não foi possível gerar o link agora. Tente de novo.", 500);
  }
  const origin = new URL(req.url).origin;
  return NextResponse.json(
    {
      url: `${origin}/cadastro-acessibilidade/${code}/export?format=csv`,
      count: result.rows.length,
      unknown: result.unknown.slice(0, 50),
      unknownTotal: result.unknown.length,
      expiresInDays: CADASTRO_TTL_DAYS,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
