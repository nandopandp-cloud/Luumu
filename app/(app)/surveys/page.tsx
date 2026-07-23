import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SurveysTable, type SurveyListItem } from "@/components/survey/SurveysTable";
import { listSurveys } from "@/lib/db/surveys";
import { getCurrentWorkspaceId } from "@/lib/auth/current";
import { timeAgo } from "@/lib/utils";
import type { SurveyStatus } from "@/lib/mock/surveys";

export const dynamic = "force-dynamic";

export default async function SurveysPage() {
  const workspaceId = await getCurrentWorkspaceId();
  const rows = await listSurveys(workspaceId);

  const items: SurveyListItem[] = rows.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    status: s.status as SurveyStatus,
    channel: s.channel,
    responseCount: s.responseCount,
    score: s.score,
    updatedAtLabel: timeAgo(s.updatedAt),
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Pesquisas"
        title="Pesquisas"
        description="Crie, dispare e acompanhe pesquisas de CSAT, NPS, CES e muito mais."
        actions={
          <Button href="/surveys/new" size="sm">
            <Plus className="size-4" /> Nova pesquisa
          </Button>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          mascot="Trabalhando"
          title="Nenhuma pesquisa ainda"
          description="Crie sua primeira pesquisa e comece a ouvir seus clientes."
          action={<Button href="/surveys/new"><Plus className="size-4" /> Nova pesquisa</Button>}
        />
      ) : (
        <SurveysTable items={items} />
      )}
    </div>
  );
}
