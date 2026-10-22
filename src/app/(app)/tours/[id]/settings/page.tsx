import { notFound } from "next/navigation";
import { getTourEditor } from "@/lib/db/tours";
import { listHosts } from "@/lib/db/hosts";
import { listEvents } from "@/lib/db/events";
import { getCurrentProjectId } from "@/lib/auth/current";
import { TourSettingsForm } from "@/components/tours/TourSettingsForm";

export const dynamic = "force-dynamic";

export default async function TourSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const projectId = await getCurrentProjectId();
  const [editor, hosts, events] = await Promise.all([getTourEditor(id, projectId), listHosts(projectId), listEvents(projectId)]);
  if (!editor) notFound();
  return <TourSettingsForm tourId={id} initial={editor.settings} hosts={hosts} events={events.map((e) => e.name)} />;
}
