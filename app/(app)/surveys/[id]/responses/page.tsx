import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { ResponsesView } from "@/components/responses/ResponsesView";
import { surveys } from "@/lib/mock/surveys";

export default async function SurveyResponsesPage({
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
      <PageHeader eyebrow="Respostas da pesquisa" title={survey.name} description="Respostas individuais, distribuição e temas desta pesquisa." />
      <ResponsesView />
    </div>
  );
}
