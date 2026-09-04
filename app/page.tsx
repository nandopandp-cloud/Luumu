import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

export default async function Home() {
  // a raiz é o link que as pessoas guardam; mandá-la sempre para /login jogava quem já
  // tem sessão de volta ao formulário, como se o acesso à plataforma tivesse falhado.
  const session = await getSession();
  redirect(session ? "/dashboard" : "/login");
}
