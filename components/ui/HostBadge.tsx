import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { hostLabel } from "@/lib/hosts";

/**
 * Identifica a plataforma (hostname) de uma pesquisa, evento ou resposta. Mostra o rótulo
 * curto e deixa o endereço completo no title. `all` são as plataformas do projeto, usadas
 * para desambiguar rótulos curtos repetidos.
 */
export function HostBadge({ host, all, className }: { host: string; all?: string[]; className?: string }) {
  return (
    <span
      title={host}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full bg-info/10 px-2 py-0.5 text-[11px] font-semibold text-info",
        className
      )}
    >
      <Globe className="size-3 shrink-0" />
      <span className="truncate">{hostLabel(host, all)}</span>
    </span>
  );
}
