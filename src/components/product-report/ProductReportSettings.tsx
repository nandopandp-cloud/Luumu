"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { METRIC_META, METRICS, PLATFORMS, type PlatformKey, type Weights } from "@/lib/product-report/indicators";
import { saveSettingsAction } from "@/app/(app)/product-report/actions";

export interface SettingsValue {
  platformProjects: Partial<Record<PlatformKey, string>>;
  weights: Weights;
  autoSync: boolean;
}

const toText = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v).replace(".", ","));
function parseNum(s: string): number | null | undefined {
  const t = s.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function ProductReportSettings({ settings, projects }: { settings: SettingsValue; projects: { id: string; name: string }[] }) {
  return (
    <SourcesForm settings={settings} projects={projects} />
  );
}

function SourcesForm({ settings, projects }: { settings: SettingsValue; projects: { id: string; name: string }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [map, setMap] = useState<Record<string, string>>(() => Object.fromEntries(PLATFORMS.map((p) => [p.key, settings.platformProjects[p.key] ?? ""])));
  const [weights, setWeights] = useState<Record<string, string>>(() => Object.fromEntries(METRICS.map((m) => [m, toText(settings.weights[m])])));
  const [autoSync, setAutoSync] = useState(settings.autoSync);
  const [pending, startTransition] = useTransition();
  const total = METRICS.reduce((a, m) => a + (parseNum(weights[m]) ?? 0), 0);

  const save = () =>
    startTransition(async () => {
      const w = Object.fromEntries(METRICS.map((m) => [m, parseNum(weights[m])]));
      if (Object.values(w).some((v) => v === undefined || v === null)) return toast("error", "Informe os três pesos.");
      const r = await saveSettingsAction({
        platformProjects: Object.fromEntries(PLATFORMS.map((p) => [p.key, map[p.key] || null])),
        weights: w,
        autoSync,
      });
      if (!r.ok) return toast("error", r.error);
      toast("success", "Configuração salva. Atualize os indicadores para aplicar.");
      router.refresh();
    });

  return (
    <Card>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <CardTitle>Fontes de dados</CardTitle>
          <CardSubtitle>Projeto da Luumu de cada plataforma, pesos da North Star e atualização automática.</CardSubtitle>
        </div>
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Salvar
        </Button>
      </div>
      <div className="flex flex-col gap-3">
        {PLATFORMS.map((p) => (
          <Field key={p.key} label={p.label}>
            <Select value={map[p.key]} onChange={(e) => setMap((m) => ({ ...m, [p.key]: e.target.value }))}>
              <option value="">— Nenhum projeto —</option>
              {projects.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </Select>
          </Field>
        ))}
        <div className="grid grid-cols-3 gap-3">
          {METRICS.map((m) => (
            <Field key={m} label={`Peso ${METRIC_META[m].label}`}>
              <Input value={weights[m]} inputMode="decimal" onChange={(e) => setWeights((w) => ({ ...w, [m]: e.target.value }))} />
            </Field>
          ))}
        </div>
        {total !== 100 && <p className="text-xs text-aviso">Os pesos somam {total.toLocaleString("pt-BR")}. Na planilha somam 100 (North Star na meta = 100).</p>}
        <div className="flex items-start justify-between gap-4 rounded-xl border border-line p-3">
          <div>
            <div className="text-sm font-semibold">Atualização automática</div>
            <p className="text-xs text-fg-mut">
              No dia seguinte ao fim de cada quinzena (dias 1 e 16), a Luumu busca os indicadores da quinzena encerrada. Não envia e-mail.
            </p>
          </div>
          <Switch checked={autoSync} onChange={setAutoSync} label="Atualização automática" />
        </div>
      </div>
    </Card>
  );
}
