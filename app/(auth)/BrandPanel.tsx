import Image from "next/image";

/**
 * Painel de marca das telas de autenticação: arte única (headline, mascote,
 * cards de métricas e features) exportada do design.
 *
 * A arte é 5:4 e a coluna é alta e estreita: `object-cover` recortaria a
 * headline (~240px de cada lado), então a imagem ocupa toda a largura do painel
 * e fica centrada na vertical. O gradiente de fundo acompanha o da própria arte
 * e as máscaras dissolvem as bordas superior/inferior, sem emenda aparente.
 */
export function BrandPanel() {
  return (
    <div className="relative hidden overflow-hidden lg:block [background:linear-gradient(160deg,#1D076B_0%,#160559_45%,#0E053F_100%)]">
      <div className="absolute inset-0 grid place-items-center">
        <div className="relative aspect-[1402/1122] w-full [mask-image:linear-gradient(to_bottom,transparent,#000_8%,#000_92%,transparent)]">
          <Image
            src="/login-panel.png"
            alt="Luumu — Ouça. Entenda. Melhore. A plataforma de Voice of Customer que transforma feedback em crescimento real."
            fill
            priority
            sizes="50vw"
            className="object-contain"
          />
        </div>
      </div>
    </div>
  );
}
