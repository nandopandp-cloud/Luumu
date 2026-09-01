import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SurveySettingsForm } from "@/components/survey/SurveySettingsForm";
import { SurveySubnav } from "@/components/survey/SurveySubnav";
import { getSurvey } from "@/lib/db/surveys";
import { listEvents } from "@/lib/db/events";
import { getStats } from "@/lib/db/responses";
import { getCurrentProjectId } from "@/lib/auth/current";

export const dynamic = "force-dynamic";

export default async function SurveySettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // escopo por projeto ativo (e não só por workspace): impede abrir por URL direta
  // uma pesquisa de projeto que o membro não tem permissão de ver
  const projectId = await getCurrentProjectId();
  const survey = await getSurvey(id, { projectId });
  if (!survey) notFound();
  // eventos disponíveis como gatilho são os do projeto desta pesquisa
  const [events, stats] = await Promise.all([
    listEvents(survey.projectId),
    getStats({ projectId: survey.projectId, surveyId: survey.id }),
  ]);

  return (
    <div>
      <Link
        href="/surveys"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-fg-mut hover:text-accent"
      >
        <ArrowLeft className="size-4" /> Pesquisas
      </Link>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">{survey.name}</h1>
        <p className="mt-1 text-sm text-fg-mut">
          Defina quando, para quem e com que frequência esta pesquisa é exibida.
        </p>
      </div>

      <SurveySubnav id={id} />

      <SurveySettingsForm
        initial={{
          id: survey.id,
          channel: survey.channel,
          audience: survey.audience,
          language: survey.language,
          // gatilhos: usa o array novo; se vazio mas houver o legado, converte
          triggerEvents:
            ((survey.triggerEvents as string[]) ?? []).length > 0
              ? (survey.triggerEvents as string[])
              : survey.triggerEvent
              ? [survey.triggerEvent]
              : [],
          audienceMode: (survey.audienceMode as "email" | "id" | null) ?? null,
          audienceList: (survey.audienceList as string[]) ?? [],
          frequency: survey.frequency,
          startsAt: survey.startsAt ?? "",
          endsAt: survey.endsAt ?? "",
          responseLimit: survey.responseLimit ?? null,
        }}
        events={events}
        currentResponses={stats.total}
      />
    </div>
  );
}
