"use client";

import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

/** Compartilha o link público da pesquisa (menu nativo no celular; copia no computador). */
export function ShareSurveyButton({ surveyId, name }: { surveyId: string; name: string }) {
  const toast = useToast();
  async function share() {
    const url = `${window.location.origin}/s/${surveyId}`;
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) return await navigator.share({ title: name, url });
      await navigator.clipboard.writeText(url);
      toast("success", "Link da pesquisa copiado. É só colar onde seus usuários estão.");
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") toast("error", "Não foi possível compartilhar. Copie o link na pré-visualização.");
    }
  }
  return (
    <Button onClick={share} className="w-full justify-center">
      <Share2 className="size-4" /> Compartilhar pesquisa
    </Button>
  );
}
