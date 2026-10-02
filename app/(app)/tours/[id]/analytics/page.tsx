import { notFound } from "next/navigation";
import { getTourEditor } from "@/lib/db/tours";
import { getTourAnalytics } from "@/lib/db/tour-events";
import { getCurrentProjectId } from "@/lib/auth/current";
import { TourAnalyticsView, type FunnelStep } from "@/components/tours/TourAnalyticsView";

export const dynamic = "force-dynamic";

const DAYS = 30;

export default async function TourAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const projectId = await getCurrentProjectId();
  const [editor, data] = await Promise.all([getTourEditor(id, projectId), getTourAnalytics(id, projectId, DAYS)]);
  if (!editor || !data) notFound();

  // ordem e nomes vêm do rascunho; passos que saíram do tour continuam no funil (dados reais)
  const byKey = new Map(data.steps.map((s) => [s.stepKey, s]));
  const funnel: FunnelStep[] = editor.steps
    .filter((s) => s.enabled || byKey.has(s.key))
    .map((s) => {
      const m = byKey.get(s.key);
      return {
        key: s.key,
        label: s.title || "Sem título",
        viewed: m?.viewed ?? 0,
        completed: m?.completed ?? 0,
        abandonedHere: m?.abandonedHere ?? 0,
        notFound: m?.notFound ?? 0,
        avgMs: m?.avgMs ?? null,
      };
    });
  for (const m of data.steps) {
    if (!editor.steps.some((s) => s.key === m.stepKey)) {
      funnel.push({ key: m.stepKey, label: "Passo removido", viewed: m.viewed, completed: m.completed, abandonedHere: m.abandonedHere, notFound: m.notFound, avgMs: m.avgMs });
    }
  }
  return <TourAnalyticsView data={data} funnel={funnel} days={DAYS} />;
}
