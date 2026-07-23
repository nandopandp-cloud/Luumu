import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SurveySettingsForm } from "@/components/survey/SurveySettingsForm";
import { SurveySubnav } from "@/components/survey/SurveySubnav";
import { getSurvey } from "@/lib/db/surveys";

export const dynamic = "force-dynamic";

export default async function SurveySettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const survey = await getSurvey(id);
  if (!survey) notFound();

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
          segment: survey.segment,
          language: survey.language,
          trigger: survey.trigger,
          frequency: survey.frequency,
          delay: survey.delay,
          startsAt: survey.startsAt ?? "",
          endsAt: survey.endsAt ?? "",
        }}
      />
    </div>
  );
}
