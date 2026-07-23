import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { SurveySubnav } from "@/components/survey/SurveySubnav";
import { AppearanceEditor } from "@/components/survey/AppearanceEditor";
import { getSurveyWithQuestions } from "@/lib/db/surveys";
import { normalizeAppearance, type BuilderQuestion } from "@/lib/builder";

export const dynamic = "force-dynamic";

const statusTone = {
  ativa: "success", pausada: "warn", encerrada: "neutral", rascunho: "brand",
} as const;

export default async function AppearancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getSurveyWithQuestions(id);
  if (!data) notFound();
  const { survey, questions } = data;

  const rendered: BuilderQuestion[] = questions.map((q) => ({
    uid: q.id,
    blockId: q.blockId,
    title: q.title,
    required: q.required,
    config: (q.config as BuilderQuestion["config"]) ?? {},
    logic: (q.logic as BuilderQuestion["logic"]) ?? {},
  }));

  return (
    <div>
      <Link
        href="/surveys"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-fg-mut hover:text-accent"
      >
        <ArrowLeft className="size-4" /> Pesquisas
      </Link>

      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-extrabold tracking-tight">{survey.name}</h1>
          <Badge tone="brand" dot={false}>{survey.type}</Badge>
          <Badge tone={statusTone[survey.status as keyof typeof statusTone]}>{survey.status}</Badge>
        </div>
        <p className="mt-1 text-sm text-fg-mut">
          Escolha como a pesquisa aparece dentro do produto do seu cliente. O preview mostra o resultado real.
        </p>
      </div>

      <SurveySubnav id={id} />

      <AppearanceEditor
        id={id}
        surveyName={survey.name}
        questions={rendered}
        initial={normalizeAppearance(survey.appearance)}
      />
    </div>
  );
}
