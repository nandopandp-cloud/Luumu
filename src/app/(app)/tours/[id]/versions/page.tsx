import { notFound } from "next/navigation";
import { getTourEditor, listTourVersions } from "@/lib/db/tours";
import { getCurrentProjectId } from "@/lib/auth/current";
import { TourVersions } from "@/components/tours/TourVersions";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TourVersionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const projectId = await getCurrentProjectId();
  const [versions, editor] = await Promise.all([listTourVersions(id, projectId), getTourEditor(id, projectId)]);
  if (!versions || !editor) notFound();
  return (
    <TourVersions
      tourId={id}
      dirty={editor.tour.hasUnpublishedChanges}
      versions={versions.map((v) => ({
        id: v.id,
        version: v.version,
        status: v.status,
        publishedAtLabel: v.publishedAt ? timeAgo(v.publishedAt) : "",
        publishedBy: v.publishedBy,
        stepCount: v.stepCount,
      }))}
    />
  );
}
