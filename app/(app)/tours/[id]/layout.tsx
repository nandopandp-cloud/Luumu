import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTourEditor } from "@/lib/db/tours";
import { listHosts } from "@/lib/db/hosts";
import { getCurrentProjectId } from "@/lib/auth/current";
import { TourHeader } from "@/components/tours/TourHeader";

export const dynamic = "force-dynamic";

export default async function TourLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const projectId = await getCurrentProjectId();
  const [editor, hosts] = await Promise.all([getTourEditor(id, projectId), listHosts(projectId)]);
  if (!editor) notFound();

  return (
    <div>
      <Link href="/tours" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-fg-mut hover:text-accent">
        <ArrowLeft className="size-4" /> Tours
      </Link>
      <TourHeader
        id={id}
        name={editor.tour.name}
        description={editor.tour.description}
        status={editor.tour.status}
        version={editor.publishedVersion}
        dirty={editor.tour.hasUnpublishedChanges}
        startUrl={editor.settings.startUrl}
        hosts={hosts}
      />
      {children}
    </div>
  );
}
