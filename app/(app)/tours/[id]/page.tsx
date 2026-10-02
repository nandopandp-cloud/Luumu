import { notFound } from "next/navigation";
import { getTourEditor } from "@/lib/db/tours";
import { listHosts } from "@/lib/db/hosts";
import { getCurrentProjectId } from "@/lib/auth/current";
import { TourBuilder } from "@/components/tours/TourBuilder";

export const dynamic = "force-dynamic";

export default async function TourBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const projectId = await getCurrentProjectId();
  const [editor, hosts] = await Promise.all([getTourEditor(id, projectId), listHosts(projectId)]);
  if (!editor) notFound();
  return <TourBuilder tourId={id} initialSteps={editor.steps} settings={editor.settings} hosts={hosts} />;
}
