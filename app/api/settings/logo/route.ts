import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getSession } from "@/lib/auth/session";
import { canManageWorkspace } from "@/lib/auth/current";
import { updateWorkspace } from "@/lib/db/workspace";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];

/**
 * POST /api/settings/logo  (multipart/form-data, campo "file")
 * Sobe a logo do workspace para o Vercel Blob e grava a URL. Só owner/admin.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!(await canManageWorkspace())) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Upload de imagem ainda não está configurado. Crie um Blob Store na Vercel." },
      { status: 503 }
    );
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo ausente." }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: "Formato inválido. Use PNG, JPG, SVG ou WEBP." }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Imagem muito grande (máx. 2 MB)." }, { status: 413 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  let blob;
  try {
    blob = await put(`workspaces/${session.workspaceId}/logo-${Date.now()}.${ext}`, file, {
      access: "public",
      contentType: file.type,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("private access")) {
      return NextResponse.json(
        {
          error:
            "O Blob Store conectado é privado, e a Vercel não permite trocar o modo de acesso depois de criado. " +
            "Crie um novo Blob Store com acesso \"Public\" e atualize BLOB_READ_WRITE_TOKEN.",
        },
        { status: 503 }
      );
    }
    throw err;
  }

  await updateWorkspace(session.workspaceId, { logoUrl: blob.url });
  return NextResponse.json({ url: blob.url });
}
