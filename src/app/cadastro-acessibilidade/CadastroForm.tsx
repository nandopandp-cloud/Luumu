"use client";

import { useRef, useState } from "react";
import { Check, Loader2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

type Done = { url: string; count: number; unknown: { line: number; value: string }[]; unknownTotal: number; expiresInDays: number };

/** Colar o link ou enviar o arquivo → link pronto. Sem etapas: a conversão é toda no servidor. */
export function CadastroForm() {
  const [link, setLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [copied, setCopied] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  function pick(f: File | undefined) {
    if (!f) return;
    if (!/\.(csv|xlsx)$/i.test(f.name)) return setError("Envie um arquivo .csv ou .xlsx.");
    setFile(f);
    setLink("");
    setError(null);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      if (link.trim()) fd.append("link", link.trim());
      else if (file) fd.append("file", file);
      const r = await fetch("/api/cadastro-acessibilidade", { method: "POST", body: fd });
      const d = (await r.json().catch(() => ({}))) as Partial<Done> & { error?: string };
      if (!r.ok || !d.url) return setError(d.error ?? "Não foi possível gerar o link. Tente de novo.");
      setDone(d as Done);
    } catch {
      setError("Sem conexão com a Luumu. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!done) return;
    try {
      await navigator.clipboard.writeText(done.url);
    } catch {
      (document.getElementById("cad-link") as HTMLInputElement | null)?.select();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  function reset() {
    setDone(null);
    setFile(null);
    setLink("");
    setError(null);
  }

  const card = "w-full max-w-[560px] rounded-[20px] border border-line bg-bg-elev p-7";

  if (done) {
    return (
      <section className={cn(card, "text-center")} aria-live="polite">
        <span className="mx-auto mb-3.5 grid size-13 place-items-center rounded-full bg-sucesso/12 text-sucesso">
          <Check className="size-6.5" strokeWidth={2.6} />
        </span>
        <h1 className="font-display text-2xl font-extrabold text-fg">Link pronto</h1>
        <p className="mt-1">
          {done.count} {done.count === 1 ? "estudante" : "estudantes"} · válido por {done.expiresInDays} dias.
        </p>
        <div className="mb-2.5 mt-5 flex gap-2">
          <input id="cad-link" readOnly value={done.url} onFocus={(e) => e.target.select()} aria-label="Link da planilha" className="min-w-0 flex-1 rounded-xl border-[1.5px] border-line bg-bg-sunken px-3 py-3 font-mono text-[13px] text-fg" />
          <button type="button" onClick={copy} className="rounded-xl bg-accent px-5 font-bold text-accent-contrast">
            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>
        {done.unknownTotal > 0 && (
          <div className="mb-3.5 rounded-xl bg-aviso/15 px-3.5 py-3 text-left text-sm text-[#8A4B05] dark:text-[#fde047]">
            <b>Necessidade não reconhecida</b> (ficou sem perfil):
            <ul className="mt-1.5 list-disc pl-5">
              {done.unknown.slice(0, 8).map((u) => (
                <li key={u.line}>
                  Linha {u.line}: “{u.value}”
                </li>
              ))}
              {done.unknownTotal > 8 && <li>e mais {done.unknownTotal - 8}</li>}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-4 text-sm">
          <a href={done.url} className="p-1 font-semibold text-accent">
            Baixar o arquivo (.csv)
          </a>
          <button type="button" onClick={reset} className="p-1 font-semibold text-accent">
            Enviar outra planilha
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={card}>
      <h1 className="font-display text-2xl font-extrabold text-fg">Cadastro de acessibilidade</h1>
      <p className="mb-5 mt-1.5">Envie a planilha-modelo e receba o link pronto para importar.</p>

      <label htmlFor="cad-gs" className="mb-1.5 block text-[13.5px] font-semibold text-fg">
        Link do Google Planilhas
      </label>
      <input
        id="cad-gs"
        value={link}
        onChange={(e) => {
          setLink(e.target.value);
          if (e.target.value.trim()) setFile(null);
          setError(null);
        }}
        placeholder="https://docs.google.com/spreadsheets/d/…"
        spellCheck={false}
        autoComplete="off"
        className="w-full rounded-xl border-[1.5px] border-line bg-bg-elev px-3.5 py-3 text-fg outline-none focus:border-accent"
      />

      <div className="my-4 flex items-center gap-3 text-[13px] text-fg-mut before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">ou</div>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          pick(e.dataTransfer.files[0]);
        }}
        className={cn("block cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition", over ? "border-accent bg-surface-brand" : "border-accent/30 bg-bg-sunken")}
      >
        <input ref={input} type="file" accept=".csv,.xlsx" className="sr-only" onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ""))} />
        <span>
          <Upload className="mr-1.5 inline size-4 align-[-3px] text-accent" />
          <b className="text-accent">Escolher arquivo</b> ou arrastar aqui · .csv ou .xlsx
        </span>
        {file && <span className="mt-1 block font-semibold text-fg">{file.name}</span>}
      </label>

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-erro/10 px-3.5 py-3 text-sm text-erro">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={busy || (!link.trim() && !file)}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3.5 text-[15px] font-bold text-accent-contrast transition disabled:opacity-50"
      >
        {busy && <Loader2 className="size-4 animate-spin" />}
        {busy ? "Gerando…" : "Gerar link"}
      </button>
    </section>
  );
}
