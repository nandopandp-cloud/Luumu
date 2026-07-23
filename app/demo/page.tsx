import type { Metadata } from "next";
import { DemoApp } from "./DemoApp";
import { resolveKey } from "@/lib/api/keys";
import { listActiveSurveys } from "@/lib/db/surveys";
import { normalizeAppearance } from "@/lib/builder";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Demo · Luumu SDK" };

// chave pública da conta demo (criada no seed)
const DEMO_KEY = "pk_demo_jovensgenios";

export default async function DemoPage() {
  const resolved = await resolveKey(DEMO_KEY);
  const active = resolved ? await listActiveSurveys(resolved.workspaceId) : [];
  const surveys = active.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    format: normalizeAppearance(s.appearance).format,
  }));
  return <DemoApp surveys={surveys} sdkKey={DEMO_KEY} />;
}
