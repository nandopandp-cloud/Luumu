import { Info } from "lucide-react";
import { Card } from "./Card";
import { Badge } from "./Badge";

/**
 * Aviso padrão para áreas ainda não conectadas a dados reais.
 * Deixa explícito que o conteúdo abaixo é ilustrativo — nunca finge ser real.
 */
export function SoonBanner({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`border-aviso/40 bg-aviso/10 ${className ?? ""}`}>
      <div className="flex items-start gap-3">
        <Info className="mt-0.5 size-5 shrink-0 text-aviso" />
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-fg">Prévia — dados ilustrativos</span>
            <Badge tone="warn" dot={false}>Em breve</Badge>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-fg-soft">{children}</p>
        </div>
      </div>
    </Card>
  );
}
