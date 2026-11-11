"use client";

import { useRef, useState } from "react";
import { BadgeCheck, Check, Copy, Download, ExternalLink, FileImage, Hand, Info, Mail, ShieldCheck, Shirt } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { librasLook, type A11yConfig } from "@/lib/accessibility/config";
import {
  HAIR_COLORS, PANTS_PRESETS, SHIRT_PRESETS, SKIN_TONES, VLIBRAS_AVATARS, VLIBRAS_DOCS, VLIBRAS_LOGO_SPEC,
  safePersonalizationUrl, vlibrasPersonalizationJson, vlibrasRequestEmail,
} from "@/lib/accessibility/vlibras";
import { ColorField, ImageField, Pills, SectionTitle, SwatchRow } from "./controls";

type Patch = (fn: (c: A11yConfig) => A11yConfig) => void;

const FACTS = [
  { icon: Hand, text: "Tradução real de português para Libras, com cerca de 21 mil sinais" },
  { icon: BadgeCheck, text: "Ferramenta oficial do governo federal, gratuita e de código aberto" },
  { icon: ShieldCheck, text: "Carregado só quando o estudante liga Libras" },
];

/**
 * Libras pelo VLibras (lib/accessibility/vlibras.ts). A personalização (cores e logo na camisa)
 * é exclusiva de parceiros aprovados pelo VLibras: aqui o cliente escolhe o que quer, gera o
 * pedido no formato oficial e, depois da aprovação, cola o endereço recebido.
 */
export function LibrasTab({ config, patch, projectName, hosts }: { config: A11yConfig; patch: Patch; projectName: string; hosts: string[] }) {
  const l = config.libras;
  const set = (p: Partial<A11yConfig["libras"]>) => patch((c) => ({ ...c, libras: { ...c.libras, ...p } }));
  const [urlDraft, setUrlDraft] = useState(l.personalizationUrl);
  const [institution, setInstitution] = useState(projectName);
  const look = librasLook(config);
  const email = vlibrasRequestEmail({ institution: institution || projectName, sites: hosts.map((h) => `https://${h}`), look });
  const approved = !!l.personalizationUrl;
  const urlInvalid = urlDraft.trim() !== "" && !safePersonalizationUrl(urlDraft);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <SectionTitle
          icon={<Hand className="size-4.5" />}
          title="Tradutor VLibras"
          description="O botão Libras abre o tradutor oficial do governo. Com ele aberto, o estudante clica num texto e o avatar 3D traduz."
          aside={<Badge tone="success" dot={false}>gov.br</Badge>}
        />
        <ul className="mb-5 grid gap-2">
          {FACTS.map((f) => (
            <li key={f.text} className="flex items-center gap-2 text-sm text-fg-soft">
              <f.icon className="size-4 shrink-0 text-accent" /> {f.text}
            </li>
          ))}
        </ul>
        <Field label="Avatar" hint="O VLibras tem três intérpretes. Na janela do tradutor o estudante também pode trocar.">
          <div className="grid gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Avatar do VLibras">
            {VLIBRAS_AVATARS.map((a) => (
              <button
                key={a.value}
                type="button"
                role="radio"
                aria-checked={l.avatar === a.value}
                onClick={() => set({ avatar: a.value })}
                className={cn("rounded-xl border p-3 text-left transition", l.avatar === a.value ? "border-accent bg-surface-brand" : "border-line hover:border-line-strong")}
              >
                <span className="block text-sm font-semibold">{a.label}</span>
                <span className="mt-0.5 block text-xs text-fg-mut">{a.hint}</span>
              </button>
            ))}
          </div>
        </Field>
      </Card>

      <Card>
        <SectionTitle
          icon={<Shirt className="size-4.5" />}
          title="Avatar com a marca do cliente"
          description="Cores da roupa, da pele e do cabelo, e a logo na camisa."
          aside={approved ? <Badge tone="success">Personalização ativa</Badge> : <Badge tone="warn">Requer aprovação</Badge>}
        />
        <p className="mb-4 flex gap-2 rounded-xl bg-surface-brand px-3 py-2.5 text-xs leading-relaxed text-fg-soft">
          <Info className="mt-0.5 size-3.5 shrink-0 text-accent" />
          <span>
            Pelas regras do VLibras, a personalização é exclusiva de instituições parceiras do projeto e passa por aprovação. Monte o pedido abaixo,
            envie à equipe do VLibras e, quando aprovarem, cole aqui o endereço que eles enviarem.{" "}
            <a href={VLIBRAS_DOCS} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-accent">
              Regras oficiais <ExternalLink className="size-3" />
            </a>
          </span>
        </p>

        <Field
          label="Endereço de personalização aprovado"
          hint={urlInvalid ? "Use o endereço https terminado em .json que o VLibras enviou." : approved ? "Os estudantes já veem o avatar personalizado." : "Vazio até a aprovação: o avatar aparece com o visual padrão do VLibras."}
        >
          <Input
            value={urlDraft}
            onChange={(e) => {
              setUrlDraft(e.target.value);
              set({ personalizationUrl: safePersonalizationUrl(e.target.value) });
            }}
            placeholder="https://vlibras.gov.br/config/….json"
            spellCheck={false}
            className={cn("font-mono text-xs", urlInvalid && "border-erro")}
            aria-invalid={urlInvalid}
          />
        </Field>

        <div className="mt-5 grid gap-4 border-t border-line pt-5">
          <p className="text-sm font-semibold text-fg-soft">{approved ? "Visual pedido" : "Monte o pedido"}</p>
          <Field label="Camisa">
            <ColorField label="Cor da camisa" value={l.shirt} onChange={(shirt) => set({ shirt })} presets={SHIRT_PRESETS} />
          </Field>
          <Field label="Calça">
            <ColorField label="Cor da calça" value={l.pants} onChange={(pants) => set({ pants })} presets={PANTS_PRESETS} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tom de pele">
              <SwatchRow label="Tom de pele" value={l.skin} onChange={(skin) => set({ skin })} options={SKIN_TONES} />
            </Field>
            <Field label="Cabelo e sobrancelhas">
              <SwatchRow label="Cor do cabelo" value={l.hair} onChange={(hair) => set({ hair })} options={HAIR_COLORS} />
            </Field>
          </div>
          <Field label="Logo na camisa">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-3">
                <Pills
                  label="Logo na camisa"
                  value={l.logo}
                  onChange={(logo) => set({ logo })}
                  options={[
                    { value: "brand", label: "Logo do painel" },
                    { value: "custom", label: "Outra imagem" },
                    { value: "none", label: "Camisa lisa" },
                  ]}
                />
                {l.logo !== "none" && (
                  <Pills label="Posição da logo" value={l.logoPosition} onChange={(logoPosition) => set({ logoPosition })} options={[{ value: "chest", label: "No peito" }, { value: "center", label: "No centro" }]} />
                )}
              </div>
              {l.logo === "brand" && !config.brand.logoUrl && <p className="text-xs text-fg-mut">Defina a logo em Aparência para usá-la aqui.</p>}
              {l.logo === "custom" && <ImageField label="URL da logo da camisa" value={l.logoUrl} onChange={(logoUrl) => set({ logoUrl })} />}
              {l.logo !== "none" && <LogoFormatter />}
            </div>
          </Field>
        </div>
      </Card>

      <Card>
        <SectionTitle icon={<Mail className="size-4.5" />} title="Pedido de personalização" description="Revise, copie e envie do e-mail da instituição. Anexe a logo gerada acima." />
        <div className="grid gap-4">
          <Field label="Nome da instituição">
            <Input value={institution} onChange={(e) => setInstitution(e.target.value)} />
          </Field>
          <Field label="Para">
            <CopyLine value={email.to} />
          </Field>
          <Field label="Assunto">
            <CopyLine value={email.subject} />
          </Field>
          <Field label="Mensagem" action={<CopyButton value={email.body} label="Copiar mensagem" />}>
            <Textarea readOnly rows={12} value={email.body} className="font-mono text-xs" />
          </Field>
          <details className="rounded-xl border border-line p-3 text-sm">
            <summary className="cursor-pointer font-semibold text-fg-soft">Arquivo de configuração no formato do VLibras</summary>
            <CodeBlock className="mt-3" lang="json" code={JSON.stringify(vlibrasPersonalizationJson(look), null, 2)} />
          </details>
          <a
            href={`mailto:${email.to}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-line-strong px-4 py-2.5 text-sm font-semibold text-fg-soft transition hover:border-accent hover:text-accent"
          >
            <Mail className="size-4" /> Abrir no programa de e-mail
          </a>
        </div>
      </Card>
    </div>
  );
}

/**
 * Deixa a logo nos critérios do VLibras: PNG 500×500, sem fundo, com 75px de margem, sem
 * esticar. Lê um arquivo local (sem depender de CORS de URL externa) e baixa o resultado.
 */
function LogoFormatter() {
  const input = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  function format(file: File) {
    setError(null);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const { size, margin } = VLIBRAS_LOGO_SPEC;
      const box = size - margin * 2;
      const scale = Math.min(box / img.naturalWidth, box / img.naturalHeight);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      canvas.getContext("2d")!.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      setResult(canvas.toDataURL("image/png"));
      URL.revokeObjectURL(url);
    };
    img.onerror = () => setError("Não consegui ler essa imagem. Use PNG, SVG, JPG ou WEBP.");
    img.src = url;
  }
  return (
    <div className="rounded-xl border border-dashed border-line-strong p-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-[repeating-conic-gradient(#e5e7eb_0_25%,#fff_0_50%)] bg-[length:12px_12px]">
          {/* eslint-disable-next-line @next/next/no-img-element -- prévia local (data URL) */}
          {result ? <img src={result} alt="Logo no padrão do VLibras" className="size-full" /> : <FileImage className="size-6 text-fg-mut" />}
        </span>
        <div className="min-w-0 flex-1 text-xs text-fg-mut">
          O VLibras pede a logo em PNG {VLIBRAS_LOGO_SPEC.size}×{VLIBRAS_LOGO_SPEC.size} px, sem fundo e com {VLIBRAS_LOGO_SPEC.margin} px de margem. Escolha o arquivo
          original (de preferência já sem fundo) e baixe a versão pronta para anexar.
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => input.current?.click()} className="rounded-lg border border-line-strong px-3 py-1.5 text-xs font-semibold text-fg-soft hover:border-accent hover:text-accent">
            Escolher arquivo
          </button>
          {result && (
            <a href={result} download="logo-vlibras-500.png" className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white">
              <Download className="size-3.5" /> Baixar PNG
            </a>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-erro">{error}</p>}
      <input ref={input} type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && format(e.target.files[0])} />
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        });
      }}
      className="inline-flex items-center gap-1 text-xs font-semibold text-fg-mut hover:text-accent"
    >
      {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {done ? "Copiado" : label}
    </button>
  );
}

function CopyLine({ value }: { value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line bg-bg-sunken px-3 py-2">
      <span className="min-w-0 flex-1 truncate font-mono text-xs">{value}</span>
      <CopyButton value={value} label="Copiar" />
    </div>
  );
}
