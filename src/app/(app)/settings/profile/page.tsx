import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { AvatarForm } from "@/components/settings/AvatarForm";
import { PasswordForm } from "@/components/settings/PasswordForm";
import { requireUser } from "@/lib/auth/current";
import { getUserById } from "@/lib/db/users";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await requireUser();
  // lê do banco, e não da sessão: o JWT é emitido no login e não reflete
  // uma foto trocada depois
  const user = await getUserById(session.userId);
  if (!user) notFound();

  return (
    <div>
      <PageHeader
        eyebrow="Configuração"
        title="Meu perfil"
        description="Sua foto e sua senha de acesso."
      />
      <SettingsNav />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AvatarForm name={user.name} email={user.email} avatarUrl={user.avatarUrl} />
        <PasswordForm />
      </div>
    </div>
  );
}
