import "server-only";

/*
  Cliente de LLM da Luumu. Fala o formato de chat compatível com OpenAI — o mesmo do Groq,
  OpenRouter, Together, Cloudflare e outros —, então trocar de provedor é só mudar variáveis
  de ambiente. Sem SDK: um `fetch`.

  Padrão: Groq + openai/gpt-oss-120b. Grátis (sem cartão), não treina com os dados enviados
  e não os retém por padrão (console.groq.com/docs/your-data). Limites do plano grátis
  (out/2026): 30 req/min, 1.000 req/dia, 8 mil tokens/min por modelo.

  Variáveis:
    GROQ_API_KEY (ou AI_API_KEY)   chave do provedor — sem ela, a IA fica desligada
    AI_BASE_URL                    padrão https://api.groq.com/openai/v1
    AI_MODEL                       padrão openai/gpt-oss-120b
    AI_FALLBACK_MODEL              padrão openai/gpt-oss-20b (cota separada no Groq)
*/

const BASE_URL = process.env.AI_BASE_URL || "https://api.groq.com/openai/v1";
const API_KEY = process.env.GROQ_API_KEY || process.env.AI_API_KEY || "";
const MODEL = process.env.AI_MODEL || "openai/gpt-oss-120b";
const FALLBACK_MODEL = process.env.AI_FALLBACK_MODEL || "openai/gpt-oss-20b";
const TIMEOUT_MS = 20_000;

export function isAiConfigured(): boolean {
  return API_KEY.length > 0;
}

export class AiError extends Error {
  constructor(
    readonly kind: "not_configured" | "rate_limited" | "unavailable" | "invalid_output",
    message: string
  ) {
    super(message);
  }
}

export interface JsonSchema {
  name: string;
  schema: Record<string, unknown>;
}

interface ChatResponse {
  choices?: { message?: { content?: string | null } }[];
  error?: { message?: string };
}

async function call(model: string, system: string, user: string, schema: JsonSchema, maxTokens: number): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model,
        temperature: 0.2, // análise, não criatividade
        max_completion_tokens: maxTokens,
        // raciocínio curto: conta na cota de tokens/min e a resposta precisa ser rápida
        ...(model.includes("gpt-oss") ? { reasoning_effort: "low", include_reasoning: false } : {}),
        response_format: { type: "json_schema", json_schema: { name: schema.name, strict: true, schema: schema.schema } },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
  } catch (e) {
    throw new AiError("unavailable", e instanceof Error ? e.message : "falha de rede");
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 429) throw new AiError("rate_limited", "limite do plano atingido");
  if (!res.ok) throw new AiError("unavailable", `HTTP ${res.status}`);
  const data = (await res.json().catch(() => ({}))) as ChatResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new AiError("invalid_output", data.error?.message ?? "resposta vazia");
  try {
    return JSON.parse(content);
  } catch {
    throw new AiError("invalid_output", "JSON inválido");
  }
}

/**
 * Chat com saída JSON estrita (o modelo é forçado a seguir o esquema). Se o modelo principal
 * estourar a cota ou falhar, tenta o reserva; se os dois falharem, lança AiError e quem chamou
 * decide o plano B.
 */
export async function chatJSON(opts: { system: string; user: string; schema: JsonSchema; maxTokens?: number }): Promise<unknown> {
  if (!isAiConfigured()) throw new AiError("not_configured", "GROQ_API_KEY ausente");
  const max = opts.maxTokens ?? 800;
  try {
    return await call(MODEL, opts.system, opts.user, opts.schema, max);
  } catch (e) {
    if (!(e instanceof AiError) || !FALLBACK_MODEL || FALLBACK_MODEL === MODEL) throw e;
    return call(FALLBACK_MODEL, opts.system, opts.user, opts.schema, max);
  }
}
