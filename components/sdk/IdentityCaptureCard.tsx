"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Loader2, ScanFace, ShieldCheck, Terminal } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { saveIdentityCaptureAction } from "@/app/(app)/settings/actions";
import { isSafeSelector, stabilizeSelector } from "@/lib/analytics/selectors";

/**
 * Nome e foto dos usuários sem mexer no Luumu.identify do produto: o SDK lê o que a própria
 * tela já mostra (menu do usuário). Vale para todos os projetos e plataformas da workspace.
 */
export function IdentityCaptureCard({
  initial,
  canManage,
  status = null,
}: {
  initial: { enabled: boolean; nameSelector: string; avatarSelector: string } | null;
  canManage: boolean;
  /** números reais das últimas 24 h (a captura está funcionando?) */
  status?: { identified: number; withName: number; withAvatar: number; withoutAnalytics: string[] } | null;
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
      toast("success", next.enabled ? "Captura ativada! Os nomes e fotos chegam conforme os usuários usam o produto (os navegadores recebem a configuração em até 30 min)." : "Captura desligada.");
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
            <SelectorField
              label="Nome"
              value={v.nameSelector}
              disabled={!canManage}
              placeholder="ex.: header [data-user-name]"
              onChange={(nameSelector) => setV({ ...v, nameSelector })}
            />
            <SelectorField
              label="Foto"
              value={v.avatarSelector}
              disabled={!canManage}
              placeholder="ex.: header img.avatar"
              onChange={(avatarSelector) => setV({ ...v, avatarSelector })}
            />
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
          <Button size="sm" onClick={() => save()} disabled={busy || (custom && (!selectorOk(v.nameSelector) || !selectorOk(v.avatarSelector)))} className="w-fit">
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Salvar
          </Button>
        )}
      </div>

      {initial.enabled && status && <CaptureHealth status={status} />}

      <div className="mt-3 flex items-start gap-2 rounded-lg bg-bg-sunken p-2.5 text-[11px] leading-relaxed text-fg-mut">
        <ShieldCheck className="mt-px size-3.5 shrink-0 text-sucesso" />
        Só de usuários identificados (logados), só o que está visível na tela: nunca campos de formulário, cookies ou
        senhas. Ative com o aval de quem é responsável pelos dados dos usuários (LGPD).
      </div>
      {!canManage && <p className="mt-2 text-[11px] text-fg-mut">Só donos e administradores podem alterar.</p>}
    </Card>
  );
}

/** A captura está funcionando? Cobertura real nas últimas 24 h e o que falta para chegar lá. */
function CaptureHealth({ status }: { status: { identified: number; withName: number; withAvatar: number; withoutAnalytics: string[] } }) {
  const pct = (n: number) => (status.identified ? Math.round((n / status.identified) * 100) : 0);
  const bar = (label: string, n: number) => (
    <div>
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="font-semibold text-fg-soft">{label}</span>
        <span className="tabular-nums text-fg-mut">
          <strong className="text-fg">{n.toLocaleString("pt-BR")}</strong> de {status.identified.toLocaleString("pt-BR")}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bg-sunken">
        <div className="h-full rounded-full [background:var(--grad-roxo)]" style={{ width: `${n ? Math.max(4, pct(n)) : 0}%` }} />
      </div>
    </div>
  );
  return (
    <div className="mt-3 flex flex-col gap-2.5 rounded-xl border border-line p-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-mut">Usuários identificados nas últimas 24 h</div>
      {status.identified === 0 ? (
        <p className="text-[11px] leading-relaxed text-fg-mut">Ainda ninguém identificado nas últimas 24 h. Os números aparecem aqui conforme os usuários logados usam o produto.</p>
      ) : (
        <>
          {bar("Com nome", status.withName)}
          {bar("Com foto", status.withAvatar)}
          {status.withName === 0 && (
            <p className="text-[11px] leading-relaxed text-fg-mut">
              Sem nomes ainda? Os navegadores recebem a configuração em até 30 min. Se continuar, teste no seu produto (abaixo) ou use seletores.
            </p>
          )}
        </>
      )}
      {status.withoutAnalytics.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-aviso/10 p-2 text-[11px] leading-relaxed text-fg-soft">
          <AlertTriangle className="mt-px size-3.5 shrink-0 text-aviso" />
          <span>
            Sem Analytics ativo (a captura não roda): <strong>{status.withoutAnalytics.join(", ")}</strong>. Ative em Analytics, com o projeto selecionado.
          </span>
        </div>
      )}
      <div className="flex items-start gap-2 text-[11px] leading-relaxed text-fg-mut">
        <Terminal className="mt-px size-3.5 shrink-0 text-accent" />
        <span>
          Para testar: abra o seu produto logado e rode <code className="rounded bg-bg-sunken px-1 py-px font-mono text-[11px] text-fg-soft">Luumu.debugIdentity()</code> no console. Ele mostra o nome e a foto que serão enviados.
        </span>
      </div>
    </div>
  );
}

/** Vazio (= automático) ou um seletor CSS válido e seguro. */
function selectorOk(s: string): boolean {
  if (!s.trim()) return true;
  if (!isSafeSelector(s.trim())) return false;
  try {
    document.createDocumentFragment().querySelector(s.trim());
    return true;
  } catch {
    return false;
  }
}

/**
 * Campo de seletor: ao colar/sair do campo, troca o ID gerado pelo React/Radix (que muda entre
 * telas e versões do produto) por um atributo estável e avisa; seletor inválido aparece na hora.
 */
function SelectorField({ label, value, disabled, placeholder, onChange }: { label: string; value: string; disabled: boolean; placeholder: string; onChange: (v: string) => void }) {
  const [note, setNote] = useState(false);
  const fix = (raw: string) => {
    const r = stabilizeSelector(raw);
    if (r.changed && r.value) setNote(true);
    onChange(r.value);
  };
  const bad = !selectorOk(value);
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-fg-soft">{label}</span>
      <Input
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onPaste={(e) => {
          e.preventDefault();
          fix(e.clipboardData.getData("text"));
        }}
        onBlur={(e) => fix(e.target.value)}
        placeholder={placeholder}
        aria-invalid={bad}
        className={cn("py-1.5 font-mono text-xs", bad && "border-erro focus:border-erro")}
      />
      {bad ? (
        <span className="text-[11px] text-erro">Seletor CSS inválido. Copie de novo pelo Inspecionar → Copiar → Copiar seletor.</span>
      ) : note ? (
        <span className="text-[11px] leading-relaxed text-sucesso">
          Ajustado: o ID automático do React (#radix-…) muda a cada tela, então usamos o botão do menu do usuário no lugar.
        </span>
      ) : null}
    </label>
  );
}
