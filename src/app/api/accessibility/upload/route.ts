import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getSession } from "@/lib/auth/session";
import { canManageWorkspace, getCurrentProjectId } from "@/lib/auth/current";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

/**
 * POST /api/accessibility/upload  (multipart/form-data, campo "file")
 * Logo do plugin de acessibilidade (cabeçalho do painel, convite e pedido de personalização do VLibras). Vai
 * para o Vercel Blob público: a imagem aparece no produto do cliente. Escopo: projeto ativo.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!(await canManageWorkspace())) return NextResponse.json({ error: "Só donos e administradores podem enviar a logo." }, { status: 403 });
  const projectId = await getCurrentProjectId();

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Upload de imagem ainda não está configurado (Blob Store da Vercel). Cole a URL da imagem." }, { status: 503 });
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Arquivo ausente." }, { status: 400 });
  const ext = ALLOWED[file.type];
  if (!ext) return NextResponse.json({ error: "Formato inválido. Use PNG, JPG, WEBP ou SVG." }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Imagem muito grande (máx. 2 MB)." }, { status: 413 });

  try {
    const blob = await put(`accessibility/${projectId}/logo-${Date.now()}.${ext}`, file, { access: "public", contentType: file.type });
    return NextResponse.json({ url: blob.url });
  } catch {
    return NextResponse.json({ error: "Não foi possível enviar a imagem." }, { status: 500 });
  }
}
