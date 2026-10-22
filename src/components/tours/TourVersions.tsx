"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { History, RotateCcw, Loader2, Radio } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { restoreTourVersionAction } from "@/app/(app)/tours/actions";

export interface VersionRow {
  id: string;
  version: number;
  status: string;
  publishedAtLabel: string;
  publishedBy: { name: string; avatarUrl: string | null } | null;
  stepCount: number;
}

/** Histórico de publicações com rollback (restaura a versão para o rascunho). */
export function TourVersions({ tourId, versions, dirty }: { tourId: string; versions: VersionRow[]; dirty: boolean }) {
  const [restoring, setRestoring] = useState<VersionRow | null>(null);
  const [busy, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  if (versions.length === 0) {
    return (
      <EmptyState
        mascot="Pensativo"
        title="Nenhuma versão publicada"
        description="Cada vez que você publica, uma versão nova fica guardada aqui. Dá para voltar a qualquer uma delas."
      />
    );
  }

  function restore(v: VersionRow) {
    start(async () => {
      const res = await restoreTourVersionAction(tourId, v.id);
      setRestoring(null);
      if (!res.ok) return toast("error", res.error);
      toast("success", `Versão ${v.version} restaurada no rascunho. Publique para colocá-la no ar.`);
      router.push(`/tours/${tourId}`);
    });
  }

  return (
    <>
      <Card padded={false}>
        <ol className="divide-y divide-line">
          {versions.map((v) => {
            const live = v.status === "published";
            return (
              <li key={v.id} className="flex flex-wrap items-center gap-4 px-6 py-4">
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-xl font-display text-sm font-bold ${
                    live ? "text-white [background:var(--grad-roxo)]" : "bg-surface-brand text-accent"
                  }`}
                >
                  v{v.version}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">Versão {v.version}</span>
                    {live ? (
                      <Badge tone="success">
                        <Radio className="size-3" /> No ar
                      </Badge>
                    ) : (
                      <Badge tone="neutral" dot={false}>
                        Anterior
                      </Badge>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-fg-mut">
                    <span>Publicada {v.publishedAtLabel}</span>
                    {v.publishedBy && (
                      <>
                        <span>por</span>
                        {v.publishedBy.avatarUrl ? (
                          <Image src={v.publishedBy.avatarUrl} alt="" width={16} height={16} className="size-4 rounded-full object-cover" />
                        ) : (
                          <span className="grid size-4 place-items-center rounded-full text-[9px] font-bold text-white [background:var(--grad-marca)]">
                            {v.publishedBy.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span className="font-semibold text-fg-soft">{v.publishedBy.name}</span>
                      </>
                    )}
                    <span>· {v.stepCount} {v.stepCount === 1 ? "passo" : "passos"}</span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setRestoring(v)} disabled={busy}>
                  <RotateCcw className="size-4" /> Restaurar
                </Button>
              </li>
            );
          })}
        </ol>
      </Card>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-fg-mut">
        <History className="size-3.5" /> Restaurar copia a versão para o rascunho. O que está no ar só muda quando você publicar.
      </p>

      {restoring && (
        <Dialog
          title={`Restaurar a versão ${restoring.version}?`}
          description={
            dirty
              ? "O rascunho atual tem alterações não publicadas, e elas serão substituídas por esta versão."
              : "O rascunho passa a ser igual a esta versão."
          }
          onClose={() => setRestoring(null)}
          footer={
            <>
              <Button variant="ghost" size="sm" onClick={() => setRestoring(null)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={() => restore(restoring)} disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" />} Restaurar no rascunho
              </Button>
            </>
          }
        />
      )}
    </>
  );
}
