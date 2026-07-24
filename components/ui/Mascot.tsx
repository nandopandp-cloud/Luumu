import Image from "next/image";
import { cn } from "@/lib/utils";

export { LuumuLogo } from "./LuumuLogo";

/** Nomes de arquivo dos SVGs oficiais em /public/mascot (assets/icones). */
export type MascotName =
  | "Feliz" | "Animado" | "Piscando" | "Pensativo" | "Surpreso" | "Apaixonado"
  | "Preocupado" | "Rindo" | "Trabalhando" | "Criando" | "Analisando"
  | "Apresentando" | "Aprovando" | "Comemorando" | "Liderando"
  | "Ouça de verdade" | "Dados viram insights" | "Melhorias"
  | "Você + Luumu" | "Clientes apaixonados";

/** Mascote estático (SVG oficial). */
export function Mascot({
  name = "Feliz",
  size = 96,
  className,
  float = false,
}: {
  name?: MascotName;
  size?: number;
  className?: string;
  float?: boolean;
}) {
  return (
    <Image
      src={`/mascot/${encodeURIComponent(name)}.svg`}
      alt={`Mascote Luumu — ${name}`}
      width={size}
      height={size}
      className={cn("select-none", float && "float", className)}
      priority={false}
    />
  );
}
