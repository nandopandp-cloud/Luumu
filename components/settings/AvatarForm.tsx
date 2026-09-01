"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, Trash2, Upload } from "lucide-react";
import { Card, CardTitle, CardSubtitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { removeAvatarAction } from "@/app/(app)/settings/profile/actions";

/** Foto de perfil do próprio usuário: envio, troca e remoção. */
export function AvatarForm({
  name,
  email,
  avatarUrl,
}: {
  name: string;
  email: string;
  avatarUrl: string | null;
}) {
  const [url, setUrl] = useState(avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [removing, startRemove] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const toast = useToast();

  const busy = uploading || removing;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/settings/avatar", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha no upload.");
      setUrl(data.url);
      toast("success", "Foto atualizada.");
      router.refresh();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Falha no upload.");
    } finally {
      setUploading(false);
      // limpa o input para permitir reenviar o mesmo arquivo depois de um erro
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function remove() {
    startRemove(async () => {
      const res = await removeAvatarAction();
      if (res.ok) {
        setUrl(null);
        toast("success", "Foto removida.");
        router.refresh();
      } else {
        toast("error", res.error ?? "Não foi possível remover a foto.");
      }
    });
  }

  return (
    <Card>
      <CardTitle>Foto de perfil</CardTitle>
      <CardSubtitle>Aparece no menu da conta e na lista de membros.</CardSubtitle>

      <div className="mt-4 flex items-center gap-4">
        {url ? (
          <Image
            src={url}
            alt="Sua foto de perfil"
            width={64}
            height={64}
            className="size-16 rounded-full object-cover"
          />
        ) : (
          <span className="grid size-16 place-items-center rounded-full text-2xl font-bold text-white [background:var(--grad-marca)]">
            {name.charAt(0).toUpperCase()}
          </span>
        )}

        <div className="flex flex-col gap-1.5">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={onPick}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {url ? "Trocar foto" : "Enviar foto"}
            </Button>
            {url && (
              <Button variant="danger" size="sm" disabled={busy} onClick={remove}>
                {removing ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                Remover
              </Button>
            )}
          </div>
          <span className="text-xs text-fg-mut">PNG, JPG ou WEBP · máx. 2 MB</span>
        </div>
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <div className="text-sm font-semibold">{name}</div>
        <div className="text-sm text-fg-mut">{email}</div>
      </div>
    </Card>
  );
}
