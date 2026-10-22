"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "@/components/ui/Link";
import { usePathname, useRouter } from "next/navigation";
import { Blocks, Users, Palette, History, BarChart3, Play, Rocket, Loader2, MousePointerClick, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { publishTourAction, renameTourAction } from "@/app/(app)/tours/actions";
import { TourStatusBadge } from "./ToursTable";
import { OpenProductDialog, type ProductMode } from "./OpenProductDialog";
import { flushDraft } from "./draft-sync";

export function TourHeader({
  id,
  name,
  description,
  status,
  version,
  dirty,
  startUrl,
  hosts,
}: {
  id: string;
  name: string;
  description: string;
  status: "draft" | "published" | "paused" | "archived";
  version: number | null;
  dirty: boolean;
  startUrl: string;
  hosts: string[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const [publishing, start] = useTransition();
  const [product, setProduct] = useState<ProductMode | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(name);
  const [savingName, startRename] = useTransition();
  const nameInputRef = useRef<HTMLInputElement>(null);

  function openRename() {
    setNameDraft(name); // pega o nome mais recente só ao abrir, não a cada render
    setEditingName(true);
  }

  useEffect(() => {
    if (editingName) nameInputRef.current?.select();
  }, [editingName]);

  function saveName() {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === name) {
      setEditingName(false);
      setNameDraft(name);
      return;
    }
    startRename(async () => {
      const res = await renameTourAction(id, trimmed);
      if (!res.ok) {
        toast("error", res.error);
        setNameDraft(name);
      } else {
        setEditingName(false);
        router.refresh();
      }
    });
  }

  const tabs = [
    { href: `/tours/${id}`, label: "Construtor", icon: Blocks },
    { href: `/tours/${id}/settings`, label: "Público e gatilho", icon: Users },
    { href: `/tours/${id}/appearance`, label: "Aparência", icon: Palette },
    { href: `/tours/${id}/versions`, label: "Versões", icon: History },
    { href: `/tours/${id}/analytics`, label: "Analytics", icon: BarChart3 },
  ];

  function publish() {
    start(async () => {
      await flushDraft();
      const res = await publishTourAction(id);
      if (!res.ok) return toast("error", res.error);
      toast("success", `Versão ${res.version} publicada. Em até 1 minuto ela chega aos usuários.`);
      router.refresh();
    });
  }

  const canPublish = status === "draft" || dirty;

  return (
    <>
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            {editingName ? (
              <div className="flex items-center gap-1.5">
                <input
                  ref={nameInputRef}
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveName();
                    if (e.key === "Escape") {
                      setEditingName(false);
                      setNameDraft(name);
                    }
                  }}
                  maxLength={120}
                  disabled={savingName}
                  className="rounded-lg border border-line-strong bg-bg-elev px-2 py-1 font-display text-2xl font-extrabold tracking-tight outline-none focus:border-accent"
                />
                <button
                  type="button"
                  aria-label="Salvar nome"
                  onClick={saveName}
                  disabled={savingName}
                  className="rounded-lg p-1.5 text-fg-mut hover:bg-bg-sunken hover:text-fg"
                >
                  {savingName ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                </button>
                <button
                  type="button"
                  aria-label="Cancelar"
                  onClick={() => {
                    setEditingName(false);
                    setNameDraft(name);
                  }}
                  disabled={savingName}
                  className="rounded-lg p-1.5 text-fg-mut hover:bg-bg-sunken hover:text-fg"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={openRename}
                className="group flex items-center gap-2 rounded-lg px-1 py-0.5 text-left hover:bg-bg-sunken"
                title="Renomear"
              >
                <h1 className="font-display text-2xl font-extrabold tracking-tight">{name}</h1>
                <Pencil className="size-4 shrink-0 text-fg-mut opacity-0 group-hover:opacity-100" />
              </button>
            )}
            <TourStatusBadge status={status} version={version} dirty={dirty} />
          </div>
          <p className="mt-1 max-w-2xl text-sm text-fg-mut">
            {description || "Configure os passos, personalize a experiência e teste no seu produto antes de publicar."}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setProduct("builder")}>
            <MousePointerClick className="size-4" /> Editar no produto
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setProduct("preview")}>
            <Play className="size-4" /> Preview no produto
          </Button>
          <Button size="sm" onClick={publish} disabled={publishing || !canPublish || status === "archived" || status === "paused"}>
            {publishing ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
            {status === "draft" ? "Publicar" : dirty ? "Publicar alterações" : "Publicado"}
          </Button>
        </div>
      </div>

      <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-line" aria-label="Seções do tour">
        {tabs.map((t) => {
          const active = pathname === t.href;
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative inline-flex shrink-0 items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors",
                active ? "text-accent" : "text-fg-mut hover:text-fg-soft"
              )}
            >
              <Icon className="size-4" />
              {t.label}
              {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full [background:var(--grad-marca)]" />}
            </Link>
          );
        })}
      </nav>

      {product && (
        <OpenProductDialog tourId={id} mode={product} startUrl={startUrl} hosts={hosts} onClose={() => setProduct(null)} />
      )}
    </>
  );
}
