import Link from "next/link";
import { ArrowLeft, Zap } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { surveys } from "@/lib/mock/surveys";

const triggers = [
  "Ao finalizar compra",
  "Ao criar conta",
  "Ao concluir onboarding",
  "Ao cancelar assinatura",
  "Ao usar determinada feature",
  "Após X dias de inatividade",
  "Ao sair da página",
];

export default async function SurveySettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const survey = surveys.find((s) => s.id === id) ?? surveys[1];
  return (
    <div>
      <Link
        href={`/surveys/${id}/builder`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-fg-mut hover:text-accent"
      >
        <ArrowLeft className="size-4" /> {survey.name}
      </Link>
      <PageHeader eyebrow="Configuração da pesquisa" title="Disparo & Público" description="Defina quando, para quem e com que frequência esta pesquisa é exibida." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Público & segmento</CardTitle>
          <div className="mt-4 flex flex-col gap-4">
            <Field label="Público">
              <Select defaultValue="todos">
                <option value="todos">Todos os usuários</option>
                <option>Novos usuários (&lt; 30 dias)</option>
                <option>Clientes pagantes</option>
                <option>Usuários em trial</option>
              </Select>
            </Field>
            <Field label="Segmento">
              <Select defaultValue="brasil">
                <option value="brasil">Brasil · Plano Growth</option>
                <option>Enterprise</option>
                <option>Free</option>
              </Select>
            </Field>
            <Field label="Idioma">
              <Select defaultValue="pt">
                <option value="pt">Português (BR)</option>
                <option>Inglês</option>
                <option>Espanhol</option>
              </Select>
            </Field>
            <Field label="Canal">
              <Select defaultValue={survey.channel}>
                <option>In-app</option>
                <option>E-mail</option>
                <option>Link</option>
                <option>WhatsApp</option>
              </Select>
            </Field>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-accent" />
            <CardTitle>Trigger & frequência</CardTitle>
          </div>
          <div className="mt-4 flex flex-col gap-4">
            <Field label="Evento de disparo">
              <Select defaultValue={triggers[2]}>
                {triggers.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Frequência">
                <Select defaultValue="1x">
                  <option value="1x">Uma vez por usuário</option>
                  <option>Recorrente (30 dias)</option>
                  <option>Sempre</option>
                </Select>
              </Field>
              <Field label="Atraso">
                <Input defaultValue="5s" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Início">
                <Input type="date" defaultValue="2026-07-22" />
              </Field>
              <Field label="Fim">
                <Input type="date" defaultValue="2026-08-31" />
              </Field>
            </div>
            <div className="rounded-xl bg-bg-sunken p-3">
              <div className="mb-2 text-xs font-semibold text-fg-soft">Regras de disparo</div>
              <div className="flex flex-wrap gap-2">
                <Badge tone="brand" dot={false}>URL contém /checkout</Badge>
                <Badge tone="brand" dot={false}>Device = Desktop</Badge>
                <Badge tone="success">Ativa</Badge>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
