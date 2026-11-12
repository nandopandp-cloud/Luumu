"use client";

import { Building2, GraduationCap, Hash, KeyRound, Plus, School, Trash2, UserRound, Users } from "lucide-react";
import { Field } from "@/components/ui/Input";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { SchoolYearPicker } from "@/components/surveys/SchoolYearPicker";
import { groupIsEmpty, type AudienceGroup } from "@/lib/accessibility/audience";
import { ChipInput } from "./controls";

let groupSeq = 0;
const newGroup = (): AudienceGroup => ({ id: `g${Date.now().toString(36)}${groupSeq++}`, networks: [], schools: [], classes: [], schoolYears: [] });

/**
 * Grupos por rede, escola, turma e ano escolar (lib/accessibility/audience.ts). Usado no
 * escopo de ativação do plugin e no público do convite.
 */
export function GroupsEditor({ groups, onChange, emptyHint }: { groups: AudienceGroup[]; onChange: (g: AudienceGroup[]) => void; emptyHint?: string }) {
  const setGroup = (id: string, p: Partial<AudienceGroup>) => onChange(groups.map((g) => (g.id === id ? { ...g, ...p } : g)));
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-fg-soft">Redes, escolas e turmas</p>
        <span className="text-xs text-fg-mut">No grupo, todos os campos preenchidos precisam bater. Entre grupos, basta um.</span>
      </div>
      <div className="flex flex-col gap-3">
        {groups.length === 0 && emptyHint && <p className="rounded-xl bg-bg-sunken px-3 py-2.5 text-xs text-fg-mut">{emptyHint}</p>}
        {groups.map((g, i) => (
          <div key={g.id} className="rounded-2xl border border-line bg-bg-sunken/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-fg-mut">Grupo {i + 1}</span>
              <button type="button" onClick={() => onChange(groups.filter((x) => x.id !== g.id))} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-fg-mut hover:text-erro" aria-label={`Remover grupo ${i + 1}`}>
                <Trash2 className="size-3.5" /> Remover
              </button>
            </div>
            <div className="grid gap-3">
              <Field label="Redes" hint="Ex.: Rede Estadual SP. Vazio = qualquer rede.">
                <ChipInput label="Redes" values={g.networks} onChange={(networks) => setGroup(g.id, { networks })} placeholder="Digite e tecle Enter" />
              </Field>
              <Field label="Escolas">
                <ChipInput label="Escolas" values={g.schools} onChange={(schools) => setGroup(g.id, { schools })} placeholder="Ex.: EE Prof. Ana Rosa" />
              </Field>
              <Field label="Turmas">
                <ChipInput label="Turmas" values={g.classes} onChange={(classes) => setGroup(g.id, { classes })} placeholder="Ex.: 7º A, 8º B" />
              </Field>
              <Field label="Anos escolares">
                <SchoolYearPicker selected={g.schoolYears} onChange={(schoolYears) => setGroup(g.id, { schoolYears })} />
              </Field>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...groups, newGroup()])}
          className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong py-3 text-sm font-semibold text-fg-soft transition hover:border-accent hover:text-accent"
        >
          <Plus className="size-4" /> Adicionar grupo
        </button>
        {groups.some(groupIsEmpty) && <p className="text-xs text-fg-mut">Grupos sem nenhum critério são ignorados ao salvar (eles alcançariam todo mundo).</p>}
      </div>
    </div>
  );
}

const IDENTIFY_SNIPPET = `// no produto, depois do login do estudante
Luumu.identify({
  id: "123456",                // chave das preferências e da lista de convidados
  email: "ana@escola.sp.gov.br",
  user_hash: "…",              // assinatura do id (ver Ativação → Verificação de identidade)
  rede: "Rede Estadual SP",    // também aceita: network
  escola: "EE Prof. Ana Rosa", // também aceita: school
  turma: "7º A",               // também aceita: class, classroom
  school_year: "7º ano",
});`;

/** Como o produto informa quem é o estudante (traits lidos pelo plugin). */
export function IdentifyHint() {
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-fg-soft">
        <School className="size-4" /> Como o produto informa quem é o estudante
      </p>
      <CodeBlock code={IDENTIFY_SNIPPET} lang="js" />
      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-fg-mut">
        <span className="inline-flex items-center gap-1"><Hash className="size-3" /> id</span>·
        <span className="inline-flex items-center gap-1"><UserRound className="size-3" /> email</span>·
        <span className="inline-flex items-center gap-1"><KeyRound className="size-3" /> user_hash</span>·
        <span className="inline-flex items-center gap-1"><Building2 className="size-3" /> rede/network</span>·
        <span className="inline-flex items-center gap-1"><School className="size-3" /> escola/school</span>·
        <span className="inline-flex items-center gap-1"><Users className="size-3" /> turma/class</span>·
        <span className="inline-flex items-center gap-1"><GraduationCap className="size-3" /> school_year</span>
      </div>
    </div>
  );
}
