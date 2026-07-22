import Link from "next/link";
import { AlertTriangle, MousePointerClick, Play } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MetricCard } from "@/components/ui/MetricCard";
import { sessions } from "@/lib/mock/sessions";

export default function ReplayPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Behavior"
        title="Session Replay"
        description="Assista às sessões reais dos seus usuários — com eventos, erros e rage clicks."
      />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Sessões hoje" value="1.842" delta={7} accent="roxo" />
        <MetricCard label="Duração média" value="3m 47s" accent="azul" />
        <MetricCard label="Rage clicks" value="126" delta={-14} accent="laranja" />
        <MetricCard label="Erros JS" value="38" delta={-9} accent="verde" />
      </div>

      <Card padded={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left font-mono text-[11px] uppercase tracking-wide text-fg-mut">
                <th className="px-6 py-3 font-semibold">Usuário</th>
                <th className="px-3 py-3 font-semibold">Duração</th>
                <th className="px-3 py-3 font-semibold">Device</th>
                <th className="px-3 py-3 font-semibold">Páginas</th>
                <th className="px-3 py-3 font-semibold">Eventos</th>
                <th className="px-3 py-3 font-semibold">Sinais</th>
                <th className="px-6 py-3 text-right font-semibold">Quando</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="group border-b border-line last:border-0 hover:bg-bg-sunken/50">
                  <td className="px-6 py-3.5">
                    <Link href={`/replay/${s.id}`} className="flex items-center gap-3">
                      <span className="grid size-9 place-items-center rounded-full bg-bg-sunken text-fg-mut transition group-hover:bg-accent group-hover:text-white">
                        <Play className="size-4" />
                      </span>
                      <span>
                        <span className="block font-semibold group-hover:text-accent">{s.user}</span>
                        <span className="block font-mono text-[11px] text-fg-mut">{s.country} · {s.id}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-3.5 font-mono text-fg-soft">{s.duration}</td>
                  <td className="px-3 py-3.5 text-fg-soft">{s.device} · {s.browser}</td>
                  <td className="px-3 py-3.5 text-fg-soft">{s.pages}</td>
                  <td className="px-3 py-3.5 text-fg-soft">{s.events}</td>
                  <td className="px-3 py-3.5">
                    <div className="flex gap-1.5">
                      {s.errors > 0 && (
                        <Badge tone="error" dot={false}>
                          <AlertTriangle className="size-3" /> {s.errors}
                        </Badge>
                      )}
                      {s.rage > 0 && (
                        <Badge tone="warn" dot={false}>
                          <MousePointerClick className="size-3" /> {s.rage}
                        </Badge>
                      )}
                      {s.errors === 0 && s.rage === 0 && (
                        <Badge tone="success">limpa</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-right text-fg-mut">{s.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
