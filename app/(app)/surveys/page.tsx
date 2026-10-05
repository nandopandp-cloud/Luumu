import { BarChart3, BookOpen, Pencil, Plus, Users } from "lucide-react";
import { hostList } from "@/lib/hosts";
import { savedPlatform } from "@/lib/platform";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { IllustratedState } from "@/components/ui/IllustratedState";
import { SurveysEmptyArt } from "@/components/illustrations/EmptyArt";
import { SurveysTable, type SurveyListItem } from "@/components/survey/SurveysTable";
import { listSurveys } from "@/lib/db/surveys";
import { listHosts } from "@/lib/db/hosts";
import { getCurrentProjectId, getCurrentWorkspaceId } from "@/lib/auth/current";
import { getWorkspace } from "@/lib/db/workspace";
import { today } from "@/lib/schedule";
import { timeAgo } from "@/lib/utils";
import type { SurveyStatus } from "@/lib/mock/surveys";

export const dynamic = "force-dynamic";

export default async function SurveysPage() {
  const [projectId, workspaceId] = await Promise.all([getCurrentProjectId(), getCurrentWorkspaceId()]);
  const [rows, workspace, hosts, platform] = await Promise.all([
    listSurveys(projectId),
    getWorkspace(workspaceId),
    listHosts(projectId),
    savedPlatform(projectId),
  ]);
  // "hoje" no fuso do workspace: a vigência é uma data civil do cliente, não do relógio
  // do navegador de quem abre o painel (que pode estar em outro fuso)
  const currentDate = today(workspace?.timezone);

  const items: SurveyListItem[] = rows.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    status: s.status as SurveyStatus,
    channel: s.channel,
    targetHosts: (s.targetHosts as string[]) ?? [],
    creator: s.creator,
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
        <IllustratedState
          art={<SurveysEmptyArt className="w-full" />}
          title="Ainda não há pesquisas por aqui"
          description="Crie sua primeira pesquisa e comece a coletar feedbacks para entender melhor seus usuários."
          actions={
            <>
              <Button href="/surveys/new" className="w-full justify-center">
                <Plus className="size-4" /> Criar minha primeira pesquisa
              </Button>
              <Button href="/help?a=primeira-pesquisa" variant="ghost" className="w-full justify-center">
                <BookOpen className="size-4" /> Ver exemplos de pesquisas
              </Button>
            </>
          }
          steps={[
            { icon: Pencil, title: "Crie em minutos", text: "Modelos prontos e personalizáveis para diferentes objetivos." },
            { icon: Users, title: "Compartilhe facilmente", text: "Envie por link, QR Code ou integre ao seu produto." },
            { icon: BarChart3, title: "Obtenha insights reais", text: "Acompanhe as respostas em tempo real com relatórios intuitivos." },
          ]}
        />
      ) : (
        <SurveysTable key={platform} items={items} currentDate={currentDate} hosts={hosts} initialHosts={hostList(platform).filter((h) => hosts.includes(h))} />
      )}
    </div>
  );
}
