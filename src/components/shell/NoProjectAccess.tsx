import { EmptyState } from "@/components/ui/EmptyState";

/**
 * Mostrado quando o membro não tem nenhum projeto no seu escopo de acesso —
 * situação criada pelo owner em Configurações › Membros.
 */
export function NoProjectAccess() {
  return (
    <EmptyState
      mascot="Pensativo"
      title="Nenhum projeto liberado para você"
      description="Seu acesso ainda não inclui nenhum projeto deste workspace. Peça ao owner para liberar um projeto em Configurações › Membros & Permissões."
    />
  );
}
