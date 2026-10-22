import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getSession } from "@/lib/auth/session";
import { getCurrentProjectId } from "@/lib/auth/current";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB (GIFs animados costumam passar de 2 MB)
const ALLOWED: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

/**
 * POST /api/tours/upload  (multipart/form-data, campo "file")
 * Sobe a imagem de um passo de tour para o Vercel Blob (público: ela é exibida no produto do
 * cliente) e devolve a URL, que vai para `step.imageUrl`. Escopo: projeto ativo da sessão.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const projectId = await getCurrentProjectId();

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Upload de imagem ainda não está configurado (Blob Store da Vercel)." }, { status: 503 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Arquivo ausente." }, { status: 400 });
  const ext = ALLOWED[file.type];
  if (!ext) return NextResponse.json({ error: "Formato inválido. Use PNG, JPG, GIF, WEBP ou SVG." }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Imagem muito grande (máx. 4 MB)." }, { status: 413 });

  try {
    const blob = await put(`tours/${projectId}/step-${Date.now()}.${ext}`, file, { access: "public", contentType: file.type });
    return NextResponse.json({ url: blob.url });
  } catch {
    return NextResponse.json({ error: "Não foi possível enviar a imagem." }, { status: 500 });
  }
}
