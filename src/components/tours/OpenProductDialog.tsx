"use client";

import { useState, useTransition } from "react";
import { Loader2, MousePointerClick, Play, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { createTourLinkAction } from "@/app/(app)/tours/actions";
import { flushDraft } from "./draft-sync";

export type ProductMode = "builder" | "preview";

/** Separa uma URL salva em plataforma + caminho, para pré-preencher o diálogo. */
function splitUrl(url: string, hosts: string[]) {
  try {
    const u = new URL(url);
    return { host: u.hostname, path: u.pathname + u.search, custom: !hosts.includes(u.hostname), url };
  } catch {
    return { host: hosts[0] ?? "", path: "/", custom: hosts.length === 0, url: "" };
  }
}

/**
 * Abre o produto do cliente numa nova aba, em modo builder (selecionar elementos) ou preview
 * (rodar o rascunho). A aba é aberta já no clique (antes do token chegar) para o navegador
 * não tratar como pop-up; o endereço é preenchido quando o link assinado volta.
 */
export function OpenProductDialog({
  tourId,
  mode,
  startUrl,
  hosts,
  stepKey,
  stepLabel,
  onClose,
}: {
  tourId: string;
  mode: ProductMode;
  startUrl: string;
  hosts: string[];
  stepKey?: string;
  stepLabel?: string;
  onClose: () => void;
}) {
  const initial = splitUrl(startUrl, hosts);
  const [custom, setCustom] = useState(initial.custom);
  const [host, setHost] = useState(initial.host || hosts[0] || "");
  const [path, setPath] = useState(initial.path || "/");
  const [url, setUrl] = useState(initial.custom ? initial.url : "");
  const [busy, start] = useTransition();
  const toast = useToast();

  const finalUrl = custom ? url.trim() : host ? `https://${host}${path.startsWith("/") ? path : `/${path}`}` : "";
  const retarget = mode === "builder" && !!stepKey;

  function open() {
    // mantém `opener`: o overlay avisa o painel (postMessage) quando um passo é adicionado
    const win = window.open("about:blank", "luumu-product");
    start(async () => {
      if (mode === "preview") await flushDraft();
      const res = await createTourLinkAction({ id: tourId, mode, url: finalUrl, stepKey });
      if (!res.ok) {
        win?.close();
        toast("error", res.error);
        return;
      }
      if (win) win.location.href = res.url;
      else window.open(res.url, "luumu-product");
      onClose();
    });
  }

  const title =
    mode === "preview" ? "Preview no produto" : retarget ? "Escolher o elemento no produto" : "Editar no produto";
  const description =
    mode === "preview"
      ? stepLabel
        ? `O rascunho roda no seu produto a partir do passo "${stepLabel}". Ninguém além de você vê.`
        : "O rascunho roda no seu produto, do começo. Ninguém além de você vê, e nada entra nas métricas."
      : retarget
      ? `Clique no elemento que o passo "${stepLabel ?? ""}" deve destacar.`
      : "Seu produto abre numa nova aba com a barra da Luumu. Navegue até a tela, clique no elemento e adicione ao tour.";

  return (
    <Dialog
      title={title}
      description={description}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" onClick={open} disabled={!finalUrl || busy}>
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : mode === "preview" ? (
              <Play className="size-4" />
            ) : (
              <MousePointerClick className="size-4" />
            )}
            {mode === "preview" ? "Abrir preview" : "Abrir produto"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Endereço do produto">
          {custom ? (
            <Input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://app.seuproduto.com/dashboard" />
          ) : (
            <div className="flex gap-2">
              <Select value={host} onChange={(e) => setHost(e.target.value)} className="min-w-0 flex-1">
                {hosts.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </Select>
              <Input value={path} onChange={(e) => setPath(e.target.value)} className="w-40" placeholder="/dashboard" />
            </div>
          )}
          {hosts.length > 0 && (
            <button type="button" onClick={() => setCustom((v) => !v)} className="mt-1.5 text-xs font-semibold text-accent hover:underline">
              {custom ? "Escolher uma plataforma detectada" : "Digitar outro endereço"}
            </button>
          )}
        </Field>
        <div className="flex gap-3 rounded-xl bg-bg-sunken p-3.5 text-xs leading-relaxed text-fg-soft">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" />
          <p>
            Essa página precisa ter o SDK da Luumu instalado com a chave deste projeto. Faça login no seu produto normalmente:
            a Luumu usa a sua sessão e o acesso vale só para este tour, por algumas horas.
          </p>
        </div>
      </div>
    </Dialog>
  );
}
