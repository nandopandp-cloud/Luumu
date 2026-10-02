import { PageSkeleton } from "@/components/ui/Skeleton";

/*
  Todas as telas do painel são dinâmicas. Sem este arquivo, o clique num link só trocava a
  tela quando o servidor terminava de montar a página inteira — parecia que nada acontecia.
  Com ele a troca é imediata (o esqueleto entra na hora), o Next pré-carrega a casca das
  páginas e a navegação pode ser interrompida por outro clique.
*/
export default function Loading() {
  return <PageSkeleton />;
}
