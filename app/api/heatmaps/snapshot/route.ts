import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getCurrentProject } from "@/lib/auth/current";
import { getSnapshot } from "@/lib/db/heatmaps";
import { HEATMAP_DEVICES, type HeatmapDevice } from "@/lib/heatmaps/core";

export const dynamic = "force-dynamic";

/**
 * GET /api/heatmaps/snapshot?host&path&device — cópia da página (fundo do mapa) do projeto
 * ativo. Separada da página porque pode ter centenas de KB: o resto da tela não espera por ela.
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const project = await getCurrentProject();
  if (!project) return NextResponse.json({ error: "Sem projeto." }, { status: 404 });
  const q = new URL(req.url).searchParams;
  const d = q.get("device") ?? "";
  const device = (HEATMAP_DEVICES as readonly string[]).includes(d) ? (d as HeatmapDevice) : undefined;
  const snap = await getSnapshot(project.id, q.get("host") ?? "", q.get("path") ?? "", device);
  if (!snap) return NextResponse.json({ error: "Sem cópia desta página." }, { status: 404 });
  return NextResponse.json(snap, { headers: { "Cache-Control": "private, max-age=300" } });
}
