import { Mascot } from "@/components/ui/Mascot";

/**
 * O banco ainda não tem o que o plugin precisa (migrações 0044 e 0045): a área avisa em vez de
 * quebrar e mostra o erro do banco, que normalmente diz exatamente o que falta (tabela ou coluna).
 */
export function AccessibilityUnavailable({ detail }: { detail?: string }) {
  // a mensagem do Postgres cita só nomes de tabela/coluna; o resto (consulta, parâmetros) fica no log
  const hint = detail?.match(/(relation|column) "[^"]+"( of relation "[^"]+")? does not exist/)?.[0];
  return (
    <section className="flex flex-col items-center rounded-3xl border border-line bg-bg-elev px-6 py-14 text-center">
      <Mascot name="Preocupado" size={110} />
      <h2 className="mt-4 font-display text-xl font-bold">O plugin de acessibilidade ainda não foi configurado neste ambiente</h2>
      <p className="mt-2 max-w-md text-sm text-fg-mut">
        Aplique no banco as migrações <code>drizzle/0044_accessibility.sql</code> e <code>drizzle/0045_accessibility_identity.sql</code>, nesta ordem.
        As duas podem rodar mais de uma vez sem problema.
      </p>
      {hint && <p className="mt-3 rounded-lg bg-bg-sunken px-3 py-1.5 font-mono text-xs text-fg-soft">{hint}</p>}
    </section>
  );
}
