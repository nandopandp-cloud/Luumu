import { notFound } from "next/navigation";
import { getTourEditor } from "@/lib/db/tours";
import { getCurrentProjectId } from "@/lib/auth/current";
import { TourAppearanceForm } from "@/components/tours/TourAppearanceForm";

export const dynamic = "force-dynamic";

export default async function TourAppearancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const editor = await getTourEditor(id, await getCurrentProjectId());
  if (!editor) notFound();
  return <TourAppearanceForm tourId={id} settings={editor.settings} steps={editor.steps} />;
}
