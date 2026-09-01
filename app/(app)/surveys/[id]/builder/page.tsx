import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SurveyBuilder } from "@/components/survey-builder/SurveyBuilder";
import { SurveySubnav } from "@/components/survey/SurveySubnav";
import { getSurveyWithQuestions } from "@/lib/db/surveys";
import { getCurrentProjectId } from "@/lib/auth/current";
import type { BuilderQuestion } from "@/lib/builder";

export default async function BuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // escopo por projeto ativo (e não só por workspace): impede abrir por URL direta
  // uma pesquisa de projeto que o membro não tem permissão de ver
  const projectId = await getCurrentProjectId();
  const data = await getSurveyWithQuestions(id, { projectId });
  if (!data) notFound();
  const { survey, questions } = data;

  const initialQuestions: BuilderQuestion[] = questions.map((q) => ({
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

      <SurveySubnav id={survey.id} />

      <SurveyBuilder
        surveyId={survey.id}
        surveyName={survey.name}
        surveyType={survey.type}
        status={survey.status}
        initialQuestions={initialQuestions}
      />
    </div>
  );
}
