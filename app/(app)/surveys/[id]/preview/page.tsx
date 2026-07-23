import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LuumuLogo } from "@/components/ui/Mascot";
import { SurveyRenderer } from "@/components/survey/SurveyRenderer";
import { getSurveyWithQuestions } from "@/lib/db/surveys";
import type { BuilderQuestion } from "@/lib/builder";

export default async function PreviewPage({
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
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <Link
          href={`/surveys/${id}/builder`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-fg-mut hover:text-accent"
        >
          <ArrowLeft className="size-4" /> Voltar ao builder
        </Link>
        <Badge tone="brand">Preview</Badge>
      </div>

      <Card className="p-8 md:p-10">
        <div className="mb-8 flex items-center gap-2 border-b border-line pb-6">
          <LuumuLogo size={28} />
          <span className="font-display text-lg font-extrabold tracking-tight">Luumu</span>
        </div>
        <h1 className="mb-1 font-display text-2xl font-extrabold tracking-tight">{survey.name}</h1>
        <p className="mb-8 text-sm text-fg-mut">Sua opinião ajuda a melhorar. Leva menos de 1 minuto.</p>

        {rendered.length === 0 ? (
          <p className="text-fg-mut">Esta pesquisa ainda não tem perguntas. Volte ao builder e adicione blocos.</p>
        ) : (
          <SurveyRenderer surveyId={id} surveyName={survey.name} questions={rendered} preview />
        )}
      </Card>
    </div>
  );
}
