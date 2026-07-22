import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Mascot, type MascotName } from "@/components/ui/Mascot";
import { surveyTemplates } from "@/lib/mock/surveys";

export default function NewSurveyPage() {
  return (
    <div>
      <Link
        href="/surveys"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-fg-mut hover:text-accent"
      >
        <ArrowLeft className="size-4" /> Voltar para pesquisas
      </Link>

      <PageHeader
        eyebrow="Nova pesquisa"
        title="Escolha um ponto de partida"
        description="Comece com um template validado ou crie do zero. Você pode personalizar tudo no builder."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {surveyTemplates.map((t) => (
          <Link key={t.type} href={`/surveys/csat-produto/builder`}>
            <Card className="fx-flash group h-full transition-all duration-200 hover:-translate-y-1 hover:border-accent hover:shadow-[var(--shadow-md)]">
              <div className="flex items-start justify-between">
                <div className="grid size-14 place-items-center rounded-xl bg-surface-brand">
                  <Mascot name={t.mascot as MascotName} size={44} />
                </div>
                <ArrowRight className="size-5 text-fg-mut transition group-hover:translate-x-1 group-hover:text-accent" />
              </div>
              <h3 className="mt-4 text-lg font-bold">{t.title}</h3>
              <p className="mt-1 text-sm text-fg-mut">{t.desc}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
