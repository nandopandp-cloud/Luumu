"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Eye, Globe, KeyRound, Loader2, RefreshCw, ShieldCheck, Target, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { HostPicker } from "@/components/ui/HostPicker";
import { useToast } from "@/components/ui/Toast";
import type { A11yConfig } from "@/lib/accessibility/config";
import { revealIdentitySecretAction, setRequireVerifiedAction } from "@/app/(app)/accessibility/actions";
import { SectionTitle, ToggleRow } from "./controls";
import { GroupsEditor, IdentifyHint } from "./GroupsEditor";

type Patch = (fn: (c: A11yConfig) => A11yConfig) => void;

/** Onde o plugin aparece (lib/accessibility/scope.ts) e a verificação de identidade. */
export function ActivationTab({
  config,
  patch,
  hosts,
  canManage,
  verification,
  inviteeCount,
}: {
  config: A11yConfig;
  patch: Patch;
  hosts: string[];
  canManage: boolean;
  verification: { requireVerified: boolean; hasSecret: boolean };
  inviteeCount: number;
}) {
  const sc = config.scope;
  const scope = (p: Partial<A11yConfig["scope"]>) => patch((c) => ({ ...c, scope: { ...c.scope, ...p } }));
  const targeted = sc.mode === "targeted";

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <SectionTitle icon={<Target className="size-4.5" />} title="Onde o plugin aparece" description="Para todo o projeto ou só para alguns domínios, redes, escolas, turmas e estudantes." />
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Escopo do plugin">
          {[
            { v: "all" as const, t: "Todo o projeto", d: "Todos os domínios e todos os estudantes." },
            { v: "targeted" as const, t: "Só onde eu escolher", d: "Domínios, redes, escolas, turmas, anos ou convidados." },
          ].map((o) => (
            <button
              key={o.v}
              type="button"
              role="radio"
              aria-checked={sc.mode === o.v}
              onClick={() => scope({ mode: o.v })}
              className={cn("rounded-xl border p-3.5 text-left transition", sc.mode === o.v ? "border-accent bg-surface-brand" : "border-line hover:border-line-strong")}
            >
              <span className="block text-sm font-semibold">{o.t}</span>
              <span className="mt-0.5 block text-xs text-fg-mut">{o.d}</span>
            </button>
          ))}
        </div>
        {targeted && <p className="mt-3 rounded-xl bg-surface-brand px-3 py-2.5 text-xs leading-relaxed text-fg-soft">{scopeSummary(config, inviteeCount)}</p>}
      </Card>

      {targeted && (
        <>
          <Card>
            <SectionTitle icon={<Globe className="size-4.5" />} title="Domínios" description="Plataformas do projeto onde o plugin aparece. Nenhuma marcada = todas." />
            <HostPicker hosts={hosts} selected={sc.hosts} onChange={(h) => scope({ hosts: h })} />
          </Card>
          <Card>
            <SectionTitle icon={<Users className="size-4.5" />} title="Estudantes" description="Dentro desses domínios, quem recebe o plugin." />
            <div className="flex flex-col gap-5">
              <GroupsEditor
                groups={sc.groups}
                onChange={(groups) => scope({ groups })}
                emptyHint={sc.includeInvitees && inviteeCount ? "Sem grupos: o plugin aparece só para os convidados da lista." : "Sem grupos: todos os estudantes dos domínios escolhidos."}
              />
              <ToggleRow
                title="Convidados da lista também recebem"
                description={`Os ${inviteeCount.toLocaleString("pt-BR")} estudantes da lista do convite (aba Convite) têm o plugin mesmo fora dos grupos.`}
                checked={sc.includeInvitees}
                onChange={(includeInvitees) => scope({ includeInvitees })}
              />
              <IdentifyHint />
            </div>
          </Card>
        </>
      )}

      <IdentityCard canManage={canManage} initial={verification} />
    </div>
  );
}

function scopeSummary(config: A11yConfig, invitees: number): string {
  const sc = config.scope;
  const where = sc.hosts.length ? `em ${sc.hosts.length === 1 ? sc.hosts[0] : `${sc.hosts.length} domínios`}` : "em todos os domínios";
  const who: string[] = [];
  if (sc.groups.length) who.push(`${sc.groups.length} ${sc.groups.length === 1 ? "grupo" : "grupos"} de rede/escola/turma`);
  if (sc.includeInvitees && invitees) who.push(`${invitees.toLocaleString("pt-BR")} ${invitees === 1 ? "convidado" : "convidados"} da lista`);
  return `O plugin aparece ${where}, para ${who.length ? who.join(" e ") : "todos os estudantes"}.`;
}

const SNIPPETS = (secret: string) => ({
  node: `import { createHmac } from "node:crypto";

const userHash = createHmac("sha256", process.env.LUUMU_A11Y_SECRET) // ${secret.slice(0, 10)}…
  .update(String(estudante.id).trim().toLowerCase())
  .digest("hex");
// envie para a página e chame: Luumu.identify({ id: estudante.id, user_hash: userHash })`,
  php: `$userHash = hash_hmac('sha256', strtolower(trim((string) $estudante->id)), getenv('LUUMU_A11Y_SECRET'));
// na página: Luumu.identify({ id: "<?= $estudante->id ?>", user_hash: "<?= $userHash ?>" })`,
  python: `import hmac, hashlib, os

user_hash = hmac.new(os.environ["LUUMU_A11Y_SECRET"].encode(),
                     str(estudante.id).strip().lower().encode(), hashlib.sha256).hexdigest()
# na página: Luumu.identify({ id: estudante.id, user_hash: user_hash })`,
});

function IdentityCard({ canManage, initial }: { canManage: boolean; initial: { requireVerified: boolean; hasSecret: boolean } }) {
  const toast = useToast();
  const [required, setRequired] = useState(initial.requireVerified);
  const [secret, setSecret] = useState<string | null>(null);
  const [lang, setLang] = useState<"node" | "php" | "python">("node");
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, start] = useTransition();

  const reveal = (rotate = false) =>
    start(async () => {
      const r = await revealIdentitySecretAction(rotate);
      if (!r.ok) return toast("error", r.error);
      setSecret(r.secret);
      setConfirmRotate(false);
      if (rotate) toast("success", "Novo segredo gerado. Atualize o backend do produto.");
    });

  return (
    <Card>
      <SectionTitle
        icon={<ShieldCheck className="size-4.5" />}
        title="Verificação de identidade"
        description="As escolhas de cada estudante ficam salvas na conta dele e valem em qualquer aparelho. A verificação garante que só ele lê e muda as próprias escolhas."
        aside={required ? <Badge tone="success">Exigida</Badge> : <Badge tone="warn">Recomendada</Badge>}
      />
      <div className="flex flex-col gap-4">
        <p className="text-xs leading-relaxed text-fg-mut">
          Sem verificação, quem souber o ID de um estudante consegue ver as preferências dele, que podem indicar uma deficiência. Com ela, o backend do
          produto assina o ID com o segredo abaixo e manda a assinatura no <code>Luumu.identify</code> como <code>user_hash</code>. Ligue a exigência
          depois que o produto já estiver enviando a assinatura: antes disso, as escolhas ficam só no aparelho do estudante.
        </p>
        <div className={cn(!canManage && "pointer-events-none opacity-60")}>
          <ToggleRow
            icon={<KeyRound className="size-4.5" />}
            title="Exigir verificação"
            description={required ? "Só chamadas com user_hash válido leem e gravam preferências e conferem a lista de convidados." : "Desligada: o ID do identify basta."}
            checked={required}
            onChange={(on) =>
              start(async () => {
                const r = await setRequireVerifiedAction(on);
                if (!r.ok) return toast("error", r.error);
                setRequired(on);
                toast("success", on ? "Verificação exigida." : "Verificação não é mais exigida.");
              })
            }
          />
        </div>

        {canManage && (
          <div className="flex flex-col gap-3 rounded-2xl border border-line p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">Segredo do projeto</span>
              {secret ? (
                <span className="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-bg-sunken px-3 py-1.5">
                  <code className="min-w-0 flex-1 truncate text-xs">{secret}</code>
                  <button
                    type="button"
                    onClick={() =>
                      void navigator.clipboard?.writeText(secret).then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1400);
                      })
                    }
                    className="text-fg-mut hover:text-accent"
                    aria-label="Copiar segredo"
                  >
                    {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  </button>
                </span>
              ) : (
                <button type="button" disabled={busy} onClick={() => reveal()} className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-3 py-1.5 text-xs font-semibold text-fg-soft hover:border-accent hover:text-accent">
                  {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Eye className="size-3.5" />} {initial.hasSecret ? "Mostrar" : "Gerar segredo"}
                </button>
              )}
              {secret && !confirmRotate && (
                <button type="button" onClick={() => setConfirmRotate(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-fg-mut hover:text-erro">
                  <RefreshCw className="size-3.5" /> Trocar
                </button>
              )}
              {confirmRotate && (
                <span className="flex items-center gap-2 text-xs font-semibold">
                  As assinaturas atuais deixam de valer.
                  <button type="button" disabled={busy} onClick={() => reveal(true)} className="rounded-lg bg-erro px-2.5 py-1 text-white">
                    Trocar
                  </button>
                  <button type="button" onClick={() => setConfirmRotate(false)} className="text-fg-mut">
                    Cancelar
                  </button>
                </span>
              )}
            </div>
            <p className="text-xs text-fg-mut">Guarde no backend do produto (variável de ambiente). Nunca coloque o segredo no código da página.</p>
            <Tabs
              tabs={[
                { value: "node", label: "Node.js" },
                { value: "php", label: "PHP" },
                { value: "python", label: "Python" },
              ]}
              value={lang}
              onChange={(v) => setLang(v as typeof lang)}
            />
            <CodeBlock code={SNIPPETS(secret ?? "a11y_…")[lang]} lang={lang === "node" ? "js" : lang} />
          </div>
        )}
      </div>
    </Card>
  );
}
