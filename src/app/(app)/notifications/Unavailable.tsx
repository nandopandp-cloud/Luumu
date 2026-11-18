import { Mascot } from "@/components/ui/Mascot";

/** Migração ainda não aplicada (tabelas inexistentes). */
export function NotificationsUnavailable() {
  return (
    <section className="flex flex-col items-center rounded-3xl border border-line bg-bg-elev px-6 py-14 text-center">
      <Mascot name="Preocupado" size={110} />
      <h2 className="mt-4 font-display text-xl font-bold">As notificações ainda não foram configuradas neste ambiente</h2>
      <p className="mt-2 max-w-md text-sm text-fg-mut">Falta aplicar a migração do banco (drizzle/0048_notifications.sql).</p>
    </section>
  );
}
