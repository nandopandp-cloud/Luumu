import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ReplayPlayer } from "@/components/replay/ReplayPlayer";
import { SoonBanner } from "@/components/ui/SoonBanner";
import { sessions } from "@/lib/mock/sessions";

export default async function ReplayDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = sessions.find((s) => s.id === id) ?? sessions[0];

  return (
    <div>
      <Link
        href="/replay"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-fg-mut hover:text-accent"
      >
        <ArrowLeft className="size-4" /> Sessões
      </Link>

      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-extrabold tracking-tight">{session.user}</h1>
            <Badge tone="brand" dot={false}>{session.id}</Badge>
          </div>
          <p className="mt-1 font-mono text-sm text-fg-mut">
            {session.country} · {session.device} · {session.browser} · {session.duration} · {session.pages} páginas
          </p>
        </div>
      </div>

      <SoonBanner className="mb-4">
        Esta é uma reprodução de exemplo. A gravação real de sessões ainda não é coletada pelo SDK.
      </SoonBanner>

      <div className="opacity-70">
        <ReplayPlayer />
      </div>
    </div>
  );
}
