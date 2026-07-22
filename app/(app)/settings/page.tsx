import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardTitle, CardSubtitle } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { SettingsNav } from "@/components/settings/SettingsNav";

export default function SettingsPage() {
  return (
    <div>
      <PageHeader eyebrow="Configuração" title="Configurações" description="Gerencie seu workspace, projetos e preferências." />
      <SettingsNav />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Workspace</CardTitle>
          <CardSubtitle>Informações da sua organização.</CardSubtitle>
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <span className="grid size-16 place-items-center rounded-2xl text-2xl font-bold text-white [background:var(--grad-roxo)]">
                J
              </span>
              <Button variant="ghost" size="sm">Alterar logo</Button>
            </div>
            <Field label="Nome do workspace">
              <Input defaultValue="Jovens Gênios" />
            </Field>
            <Field label="URL">
              <Input defaultValue="jovensgenios.luumu.com" />
            </Field>
            <Field label="Fuso horário">
              <Select defaultValue="brt">
                <option value="brt">(GMT-3) Brasília</option>
                <option>(GMT-5) Nova York</option>
                <option>(GMT+0) Lisboa</option>
              </Select>
            </Field>
          </div>
        </Card>

        <Card>
          <CardTitle>Projetos</CardTitle>
          <CardSubtitle>Ambientes isolados dentro do workspace.</CardSubtitle>
          <div className="mt-4 flex flex-col gap-2.5">
            {[
              ["Educadores", "Produção", "success"],
              ["App Mobile", "Produção", "success"],
              ["Landing", "Staging", "warn"],
            ].map(([name, env, tone]) => (
              <div key={name} className="flex items-center justify-between rounded-xl border border-line p-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-lg bg-surface-brand text-sm font-bold text-accent">
                    {(name as string).charAt(0)}
                  </span>
                  <div>
                    <div className="text-sm font-semibold">{name}</div>
                    <div className="text-xs text-fg-mut">{env}</div>
                  </div>
                </div>
                <span className={`size-2 rounded-full ${tone === "success" ? "bg-sucesso" : "bg-aviso"}`} />
              </div>
            ))}
            <Button variant="subtle" size="sm" className="mt-1 w-full">+ Novo projeto</Button>
          </div>
        </Card>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost">Cancelar</Button>
        <Button>Salvar alterações</Button>
      </div>
    </div>
  );
}
