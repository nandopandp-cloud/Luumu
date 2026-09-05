import Image, { type ImageProps } from "next/image";

/**
 * <Image> para logos, que podem ser SVG (workspace e projeto aceitam; avatar não).
 *
 * O otimizador de imagens do Next recusa qualquer upstream SVG por padrão — é proteção
 * contra script embutido no arquivo, e correta como default. Habilitar `dangerouslyAllowSVG`
 * global reabriria esse risco para toda a aplicação só por causa de logos.
 *
 * Aqui o risco já foi tratado na origem (POST /api/settings/logo e /api/projects/[id]/logo
 * validam Content-Type e o Blob serve com o content-type do upload, não inferido pela URL),
 * então pular o otimizador SÓ para SVG é seguro — e SVG não ganha nada sendo redimensionado
 * por raster mesmo, é vetorial por definição.
 */
export function LogoImage({ src, alt, ...props }: ImageProps) {
  const isSvg = typeof src === "string" && src.split("?")[0].toLowerCase().endsWith(".svg");
  return <Image src={src} alt={alt} unoptimized={isSvg} {...props} />;
}
