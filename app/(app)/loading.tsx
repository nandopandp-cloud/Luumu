import { RouteLoading } from "@/components/page-loader/RouteLoading";

/*
  Todas as telas do painel são dinâmicas. Sem este arquivo, o clique num link só trocava a
  tela quando o servidor terminava de montar a página inteira — parecia que nada acontecia.
  Com ele a troca é imediata e a espera é a ameixa da Luumu correndo (PageLoader).
*/
export default function Loading() {
  return <RouteLoading />;
}
