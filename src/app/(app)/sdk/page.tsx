import { redirect } from "next/navigation";

/** SDK & Eventos virou uma aba de Configurações; links antigos continuam funcionando. */
export default function LegacySdkPage() {
  redirect("/settings/sdk");
}
