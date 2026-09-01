import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getSession } from "@/lib/auth/session";
import { updateUserAvatar } from "@/lib/db/users";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
// sem SVG, ao contrário das logos: a foto é enviada por qualquer membro (não só
// owner/admin) e um SVG pode carregar script, que rodaria no domínio do blob
const ALLOWED = ["image/png", "image/jpeg", "image/webp"];

/**
 * POST /api/settings/avatar  (multipart/form-data, campo "file")
 * Sobe a foto de perfil do próprio usuário e grava a URL. Qualquer usuário logado
 * altera a própria foto — o alvo é sempre a sessão, nunca um id vindo do cliente.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

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
    return NextResponse.json({ error: "Formato inválido. Use PNG, JPG ou WEBP." }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Imagem muito grande (máx. 2 MB)." }, { status: 413 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  let blob;
  try {
    blob = await put(`users/${session.userId}/avatar-${Date.now()}.${ext}`, file, {
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

  await updateUserAvatar(session.userId, blob.url);
  return NextResponse.json({ url: blob.url });
}
