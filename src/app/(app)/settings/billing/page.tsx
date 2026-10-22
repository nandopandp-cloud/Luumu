import { redirect } from "next/navigation";

/** A área de planos ganhou página própria (sidebar → Plano & Cobrança). */
export default function LegacyBillingPage() {
  redirect("/billing");
}
