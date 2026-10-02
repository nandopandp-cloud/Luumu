"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Blocks, Users, Palette, History, BarChart3, Play, Rocket, Loader2, MousePointerClick } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { publishTourAction } from "@/app/(app)/tours/actions";
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
  status: "draft" | "published" | "archived";
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
            <h1 className="font-display text-2xl font-extrabold tracking-tight">{name}</h1>
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
          <Button size="sm" onClick={publish} disabled={publishing || !canPublish || status === "archived"}>
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
