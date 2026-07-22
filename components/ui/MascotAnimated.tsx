import { cn } from "@/lib/utils";

/** Animações disponíveis em /public/mascot-anim (WEBM com alfa + MP4 fallback). */
type AnimName = "Feliz" | "Animado" | "Pensativo";

/**
 * Mascote animado. WEBM (VP9 + alfa) primeiro — transparência sobre qualquer fundo;
 * MP4 como fallback. Sempre muted/loop/playsinline. Só "Feliz" tem MP4.
 */
export function MascotAnimated({
  name = "Feliz",
  size = 140,
  className,
}: {
  name?: AnimName;
  size?: number;
  className?: string;
}) {
  return (
    <video
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      width={size}
      height={size}
      aria-label={`Mascote Luumu animado — ${name}`}
      className={cn("select-none", className)}
      style={{ width: size, height: "auto" }}
    >
      <source src={`/mascot-anim/${name}.webm`} type="video/webm" />
      {name === "Feliz" && <source src="/mascot-anim/Feliz.mp4" type="video/mp4" />}
    </video>
  );
}
