import { Mascot } from "@/components/ui/Mascot";

/** Sem a migração 0044 a tabela não existe: a área avisa em vez de quebrar. */
export function AccessibilityUnavailable() {
  return (
    <section className="flex flex-col items-center rounded-3xl border border-line bg-bg-elev px-6 py-14 text-center">
      <Mascot name="Preocupado" size={110} />
      <h2 className="mt-4 font-display text-xl font-bold">O plugin de acessibilidade ainda não foi configurado neste ambiente</h2>
      <p className="mt-2 max-w-md text-sm text-fg-mut">Falta aplicar a migração do banco (drizzle/0044_accessibility.sql).</p>
    </section>
  );
}
