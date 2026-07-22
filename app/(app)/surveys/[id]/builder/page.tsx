import Link from "next/link";
import { ArrowLeft, Eye, Rocket, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SurveyBuilder } from "@/components/survey-builder/SurveyBuilder";
import { surveys } from "@/lib/mock/surveys";

export default async function BuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const survey = surveys.find((s) => s.id === id) ?? surveys[1];

  return (
    <div>
      <Link
        href="/surveys"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-fg-mut hover:text-accent"
      >
        <ArrowLeft className="size-4" /> Pesquisas
      </Link>

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-extrabold tracking-tight">{survey.name}</h1>
            <Badge tone="brand" dot={false}>{survey.type}</Badge>
          </div>
          <p className="mt-1 text-sm text-fg-mut">
            Monte sua pesquisa arrastando blocos. As mudanças aparecem no preview em tempo real.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm">
            <Eye className="size-4" /> Preview
          </Button>
          <Button variant="ghost" size="sm">
            <Save className="size-4" /> Salvar rascunho
          </Button>
          <Button size="sm">
            <Rocket className="size-4" /> Publicar
          </Button>
        </div>
      </div>

      <SurveyBuilder surveyName={survey.name} />
    </div>
  );
}
