"use client";

import { useCallback } from "react";
import { askInsightsAction } from "@/app/(app)/insights/actions";
import { AiQuery } from "./AiQuery";

export interface InsightsFiltersInput {
  period?: string;
  from?: string;
  to?: string;
  surveyId?: string;
  host?: string;
}

/** AiQuery ligado à ação de servidor (IA com plano B por regras), com os filtros da página. */
export function AiQueryConnected({ filters }: { filters: InsightsFiltersInput }) {
  const ask = useCallback((question: string) => askInsightsAction({ question, filters }), [filters]);
  return <AiQuery ask={ask} />;
}
