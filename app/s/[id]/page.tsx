import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LuumuLogo, Mascot } from "@/components/ui/Mascot";
import { SurveyRenderer } from "@/components/survey/SurveyRenderer";
import { getSurveyWithQuestions } from "@/lib/db/surveys";
import type { BuilderQuestion } from "@/lib/builder";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await getSurveyWithQuestions(id);
  return { title: data ? `${data.survey.name} · Luumu` : "Pesquisa · Luumu" };
}

export default async function PublicSurveyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getSurveyWithQuestions(id);
  if (!data) notFound();
  const { survey, questions } = data;

  // Só pesquisas publicadas e ativas respondem
  if (survey.status !== "ativa") {
    return (
      <Shell>
        <div className="flex flex-col items-center py-8 text-center">
          <Mascot name="Pensativo" size={130} float />
          <h1 className="mt-5 font-display text-2xl font-extrabold">Pesquisa indisponível</h1>
          <p className="mt-1.5 max-w-sm text-fg-mut">
            {survey.status === "encerrada"
              ? "Esta pesquisa foi encerrada. Obrigado pelo interesse!"
              : "Esta pesquisa ainda não está ativa."}
          </p>
        </div>
      </Shell>
    );
  }

  const rendered: BuilderQuestion[] = questions.map((q) => ({
    uid: q.id,
    blockId: q.blockId,
    title: q.title,
    required: q.required,
    config: (q.config as BuilderQuestion["config"]) ?? {},
    logic: (q.logic as BuilderQuestion["logic"]) ?? {},
  }));

  return (
    <Shell>
      <h1 className="mb-1 font-display text-2xl font-extrabold tracking-tight">{survey.name}</h1>
      <p className="mb-8 text-sm text-fg-mut">Sua opinião ajuda a melhorar. Leva menos de 1 minuto.</p>
      <SurveyRenderer surveyId={id} surveyName={survey.name} questions={rendered} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-4 flex items-center gap-2">
          <LuumuLogo size={28} />
          <span className="font-display text-lg font-extrabold tracking-tight">Luumu</span>
        </div>
        <div className="rounded-2xl border border-line bg-bg-elev p-8 shadow-[var(--shadow-md)] md:p-10">
          {children}
        </div>
        <p className="mt-4 text-center text-xs text-fg-mut">
          Feito com 💜 pela Luumu · Ouça. Entenda. Melhore.
        </p>
      </div>
    </div>
  );
}
