"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/Input";
import { PERIOD_OPTIONS } from "@/lib/period";

export interface SurveyOption {
  id: string;
  name: string;
}

/**
 * Barra de filtros de pesquisa + período, controlada via query string (?surveyId=&period=).
 * Client component "burro": só lê/escreve a URL — quem busca os dados filtrados são as
 * Server Components das páginas, lendo searchParams e usando periodToDateFrom (lib/period.ts).
 */
export function DataFilters({ surveys }: { surveys: SurveyOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const surveyId = searchParams.get("surveyId") ?? "";
  const period = searchParams.get("period") ?? "30d";

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={surveyId}
        onChange={(e) => update("surveyId", e.target.value)}
        className="w-auto min-w-[180px] py-1.5 text-sm"
      >
        <option value="">Todas as pesquisas</option>
        {surveys.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
      <Select
        value={period}
        onChange={(e) => update("period", e.target.value)}
        className="w-auto min-w-[160px] py-1.5 text-sm"
      >
        {PERIOD_OPTIONS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
