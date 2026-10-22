"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Rocket, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { publishSurveyAction } from "@/app/(app)/surveys/actions";

/**
 * Hook de pré-publicação: o Builder guarda alterações só no estado local até o
 * autosave rodar, então publicar direto pela subnav poderia mandar pro ar uma
 * versão defasada. O Builder registra aqui um "flush" do rascunho, que rodamos
 * antes de publicar. Fora do Builder não há nada registrado e publicamos direto.
 *
 * Registry de módulo (e não Context) porque o botão vive na subnav — irmã do
 * Builder na árvore, não ancestral dele.
 */
type PrePublish = () => Promise<void>;
let prePublish: PrePublish | null = null;

export function registerPrePublish(fn: PrePublish): () => void {
  prePublish = fn;
  return () => {
    if (prePublish === fn) prePublish = null;
  };
}

export function PublishButton({ surveyId, status }: { surveyId: string; status: string }) {
  const router = useRouter();
  const toast = useToast();
  const [publishing, setPublishing] = useState(false);
  const [, startTransition] = useTransition();

  async function handlePublish() {
    setPublishing(true);
    try {
      if (prePublish) await prePublish();
      const res = await publishSurveyAction(surveyId);
      if (res.ok) {
        toast("success", "Pesquisa publicada! 🎉");
        startTransition(() => router.refresh());
      } else {
        toast("error", res.error);
      }
    } catch {
      toast("error", "Não foi possível publicar. Tente de novo.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <Button size="sm" onClick={handlePublish} disabled={publishing}>
      {publishing ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
      {status === "ativa" ? "Republicar" : "Publicar"}
    </Button>
  );
}
