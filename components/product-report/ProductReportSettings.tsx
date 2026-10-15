"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { formatValue, METRIC_META, METRICS, PLATFORM_INDICATORS, PLATFORMS, platformLabel, type PlatformIndicatorKey, type PlatformKey, type Weights } from "@/lib/product-report/indicators";
import type { ReportModel } from "@/lib/product-report/model";
import { saveManualAction, saveSettingsAction } from "@/app/(app)/product-report/actions";

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

export function ProductReportSettings({ model, settings, projects }: { model: ReportModel; settings: SettingsValue; projects: { id: string; name: string }[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <ManualValues key={`${model.period}:${model.builtAt}`} model={model} />
      <SourcesForm settings={settings} projects={projects} />
    </div>
  );
}

/**
 * Valores informados: só para o que a Luumu não mediu na quinzena (ex.: antes da coleta de
 * analytics existir). Dado da Luumu sempre vence; o campo fica bloqueado quando ele existe.
 */
function ManualValues({ model }: { model: ReportModel }) {
  const router = useRouter();
  const toast = useToast();
  const rows = model.groups.slice(1).flatMap((g) => g.rows);
  const fromLuumu = (key: PlatformIndicatorKey) => {
    const r = rows.find((x) => x.key === key);
    return !!r && r.value !== null && !!r.source?.startsWith("Luumu");
  };
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(PLATFORM_INDICATORS.map((i) => [i.key, toText(model.manual[i.key]?.value)])));
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const values: Partial<Record<PlatformIndicatorKey, number | null>> = {};
      for (const { key } of PLATFORM_INDICATORS) {
        const v = parseNum(draft[key]);
        if (v === undefined) return toast("error", "Use apenas números (ex.: 42,5).");
        if (v !== (model.manual[key]?.value ?? null)) values[key] = v;
      }
      if (!Object.keys(values).length) return toast("info", "Nada mudou.");
      const r = await saveManualAction({ period: model.period, values });
      if (!r.ok) return toast("error", r.error);
      toast("success", "Valores salvos.");
      router.refresh();
    });

  return (
    <Card>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <CardTitle>Valores informados</CardTitle>
          <CardSubtitle>Preencha só o que a Luumu não tem nesta quinzena. Aparece no relatório com a origem &quot;Informado manualmente&quot;.</CardSubtitle>
        </div>
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Salvar
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PLATFORM_INDICATORS.map(({ key, platform, metric }) => {
          const luumu = fromLuumu(key);
          const src = model.manual[key]?.source;
          return (
            <Field
              key={key}
              label={`${platformLabel(platform)} · ${METRIC_META[metric].label} (${METRIC_META[metric].unit})`}
              hint={luumu ? `A Luumu já mediu: ${formatValue(rows.find((r) => r.key === key)?.value, METRIC_META[metric].unit)}` : src === "planilha" ? "Importado da planilha North Star" : undefined}
            >
              <Input value={draft[key]} inputMode="decimal" disabled={luumu} placeholder={luumu ? "dado da Luumu" : "sem dado"} onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))} />
            </Field>
          );
        })}
      </div>
    </Card>
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
