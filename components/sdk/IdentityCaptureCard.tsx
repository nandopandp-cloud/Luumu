"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, ScanFace, ShieldCheck } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { saveIdentityCaptureAction } from "@/app/(app)/settings/actions";

/**
 * Nome e foto dos usuários sem mexer no Luumu.identify do produto: o SDK lê o que a própria
 * tela já mostra (menu do usuário). Vale para todos os projetos e plataformas da workspace.
 */
export function IdentityCaptureCard({
  initial,
  canManage,
}: {
  initial: { enabled: boolean; nameSelector: string; avatarSelector: string } | null;
  canManage: boolean;
}) {
  const [v, setV] = useState(initial ?? { enabled: false, nameSelector: "", avatarSelector: "" });
  const [custom, setCustom] = useState(!!(initial?.nameSelector || initial?.avatarSelector));
  const [busy, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const changed = JSON.stringify(v) !== JSON.stringify(initial ?? { enabled: false, nameSelector: "", avatarSelector: "" });

  function save(next = v) {
    start(async () => {
      const r = await saveIdentityCaptureAction(custom ? next : { ...next, nameSelector: "", avatarSelector: "" });
      if (!r.ok) return toast("error", r.error ?? "Não foi possível salvar.");
      toast("success", next.enabled ? "Captura ativada. Nomes e fotos aparecem nas próximas visitas de cada usuário." : "Captura desligada.");
      router.refresh();
    });
  }

  if (!initial) {
    return (
      <Card>
        <div className="flex items-center gap-2">
          <ScanFace className="size-4 text-accent" />
          <CardTitle>Nome e foto dos usuários</CardTitle>
        </div>
        <p className="mt-2 text-xs text-fg-mut">Falta aplicar a migração do banco (db/migrations/0023_identity_capture.sql).</p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <ScanFace className="size-4 text-accent" />
          <CardTitle>Nome e foto dos usuários</CardTitle>
        </div>
        <Switch
          checked={v.enabled}
          label="Capturar nome e foto"
          onChange={(enabled) => {
            if (!canManage) return;
            const next = { ...v, enabled };
            setV(next);
            save(next);
          }}
        />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-fg-mut">
        Sem mudar nada no seu produto: o SDK lê o nome e a foto que a tela já mostra para o usuário logado e
        exibe em <strong>Analytics → Usuários</strong>. Vale para <strong>todos os projetos e plataformas</strong> desta
        workspace (onde o Analytics estiver ativo).
      </p>

      <div className={cn("mt-3 flex flex-col gap-2.5", !v.enabled && "opacity-60")}>
        <div className="inline-flex w-fit rounded-lg bg-bg-sunken p-0.5 text-xs font-semibold">
          {[
            { on: false, label: "Automático" },
            { on: true, label: "Seletores CSS" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              disabled={!canManage}
              onClick={() => setCustom(o.on)}
              className={cn("rounded-md px-2.5 py-1 transition", custom === o.on ? "bg-bg-elev text-fg shadow-[var(--shadow-sm)]" : "text-fg-mut")}
            >
              {o.label}
            </button>
          ))}
        </div>
        {custom ? (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-fg-soft">Nome</span>
              <Input
                value={v.nameSelector}
                disabled={!canManage}
                onChange={(e) => setV({ ...v, nameSelector: e.target.value })}
                placeholder="ex.: header [data-user-name]"
                className="py-1.5 font-mono text-xs"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-fg-soft">Foto</span>
              <Input
                value={v.avatarSelector}
                disabled={!canManage}
                onChange={(e) => setV({ ...v, avatarSelector: e.target.value })}
                placeholder="ex.: header img.avatar"
                className="py-1.5 font-mono text-xs"
              />
            </label>
            <p className="text-[11px] leading-relaxed text-fg-mut">
              No seu produto, clique com o botão direito no nome (ou na foto) → Inspecionar → copie o seletor. Campo
              vazio = automático.
            </p>
          </>
        ) : (
          <p className="text-[11px] leading-relaxed text-fg-mut">
            Procura a foto de perfil no topo/menu da tela e o nome ao lado dela. Se não reconhecer no seu produto, use
            seletores.
          </p>
        )}
        {canManage && (changed || custom !== !!(initial.nameSelector || initial.avatarSelector)) && (
          <Button size="sm" onClick={() => save()} disabled={busy} className="w-fit">
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Salvar
          </Button>
        )}
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-lg bg-bg-sunken p-2.5 text-[11px] leading-relaxed text-fg-mut">
        <ShieldCheck className="mt-px size-3.5 shrink-0 text-sucesso" />
        Só de usuários identificados (logados), só o que está visível na tela: nunca campos de formulário, cookies ou
        senhas. Ative com o aval de quem é responsável pelos dados dos usuários (LGPD).
      </div>
      {!canManage && <p className="mt-2 text-[11px] text-fg-mut">Só donos e administradores podem alterar.</p>}
    </Card>
  );
}
