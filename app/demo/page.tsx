import type { Metadata } from "next";
import { DemoApp } from "./DemoApp";
import { listActiveSurveys } from "@/lib/db/surveys";
import { normalizeAppearance } from "@/lib/builder";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Demo · Luumu SDK" };

export default async function DemoPage() {
  const active = await listActiveSurveys();
  const surveys = active.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    format: normalizeAppearance(s.appearance).format,
  }));
  return <DemoApp surveys={surveys} />;
}
