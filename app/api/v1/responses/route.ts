import { revalidatePath } from "next/cache";
import { z } from "zod";
import { submitResponse } from "@/lib/db/responses";
import { deriveSentiment } from "@/lib/sentiment";
import { jsonCors, preflight } from "@/lib/api/cors";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

const schema = z.object({
  surveyId: z.string(),
  channel: z.string().optional(),
  answers: z.array(z.object({ questionId: z.string(), value: z.unknown() })),
  score: z.number().nullable(),
});

/**
 * POST /api/v1/responses
 * Grava uma resposta enviada pelo widget embutido (SDK).
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonCors({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonCors({ error: "Payload inválido.", issues: parsed.error.issues }, { status: 422 });
  }

  const data = parsed.data;
  await submitResponse({
    surveyId: data.surveyId,
    channel: data.channel ?? "SDK",
    answers: data.answers as { questionId: string; value: unknown }[],
    score: data.score,
    sentiment: deriveSentiment(data.score),
  });

  revalidatePath("/responses");
  revalidatePath(`/surveys/${data.surveyId}/responses`);
  revalidatePath("/dashboard");

  return jsonCors({ ok: true });
}
