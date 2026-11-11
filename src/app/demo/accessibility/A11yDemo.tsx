"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { BookOpen, CalendarDays, ChevronRight, Flame, GraduationCap, Hand, Home, LibraryBig, ListChecks, Megaphone, MessageCircle, PenLine, RotateCcw, ScanFace, Sparkles } from "lucide-react";
import type { PublicA11yConfig } from "@/lib/accessibility/config";

type View = "launcher" | "panel" | "nudge" | "libras" | "face";
interface Widget {
  boot(c: object): void;
  update(c: PublicA11yConfig): void;
  open(v?: Exclude<View, "launcher">): void;
  close(): void;
  destroy(): void;
}
const widget = () => (window as unknown as { __luumuA11y?: Widget }).__luumuA11y;

// estudante fictício: traits como o produto mandaria no Luumu.identify
const STUDENT = { id: "demo-001", email: "ana.souza@escola-aurora.edu.br", name: "Ana Souza", rede: "Rede Aurora", escola: "Escola Aurora", turma: "1ª série B", school_year: "1ª série EM" };

const NAV = [
  { icon: Home, label: "Página inicial", on: true },
  { icon: ListChecks, label: "Trilhas" },
  { icon: GraduationCap, label: "Estudar" },
  { icon: LibraryBig, label: "Biblioteca" },
  { icon: CalendarDays, label: "Cronograma" },
  { icon: MessageCircle, label: "Tutor" },
];
const TOOLS = [
  { icon: BookOpen, label: "Simulados" },
  { icon: PenLine, label: "Redação" },
];
const NEXT = [
  { subject: "Matemática", topic: "Triângulo de Pascal", color: "#4F46E5" },
  { subject: "Biologia", topic: "Introdução à genética", color: "#16A34A" },
  { subject: "Física", topic: "Método científico e fenômenos", color: "#0EA5E9" },
  { subject: "Português", topic: "Coesão e coerência textual", color: "#E11D48" },
  { subject: "História", topic: "Revolução Industrial", color: "#B45309" },
  { subject: "Geografia", topic: "Urbanização brasileira", color: "#0F766E" },
];

/**
 * Produto de demonstração (marca fictícia "Escola Aurora"): o cliente final vê exatamente o
 * que o estudante verá. Carrega /sdk-a11y.js direto (sem o core), no modo prévia do widget:
 * nada é gravado no navegador e recarregar a página zera as escolhas.
 */
export function A11yDemo({ config, embed, projectName, version }: { config: PublicA11yConfig; embed: boolean; projectName: string | null; version: string }) {
  const [ready, setReady] = useState(false);
  const cfg = useRef(config);

  function boot(nudge = false) {
    const w = widget();
    if (!w) return;
    w.boot({ api: `${location.origin}/api/v1`, key: "preview", host: location.hostname, config: cfg.current, identity: () => STUDENT, preview: { nudge } });
    setReady(true);
  }

  // prévia do painel: configuração e vista chegam por postMessage (mesma origem)
  useEffect(() => {
    if (!embed || !ready) return;
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== window.parent) return;
      const d = e.data as { source?: string; config?: PublicA11yConfig; view?: View };
      if (d?.source !== "luumu-a11y-admin") return;
      const w = widget();
      if (!w) return;
      if (d.config) {
        cfg.current = d.config;
        w.update(d.config);
      }
      if (d.view) {
        w.close();
        if (d.view !== "launcher") w.open(d.view);
      }
    };
    addEventListener("message", onMsg);
    window.parent.postMessage({ source: "luumu-a11y-demo", ready: true }, location.origin);
    return () => removeEventListener("message", onMsg);
  }, [embed, ready]);

  function reset() {
    widget()?.destroy();
    boot();
  }

  return (
    <div className="min-h-screen bg-[#F6F7FB] text-[#0F172A]" style={{ colorScheme: "light", fontFamily: "Inter, system-ui, sans-serif" }}>
      <Script src={`/sdk-a11y.js?v=${encodeURIComponent(version)}`} strategy="afterInteractive" onLoad={() => boot(!embed && config.nudge.enabled)} />

      {!embed && (
        <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-[#312E81] bg-[#1E1B4B] px-5 py-2.5 text-sm text-white">
          <p className="flex items-center gap-2">
            <Sparkles className="size-4 text-[#A5B4FC]" />
            <strong>Demonstração</strong>
            <span className="text-white/70">
              Plugin de acessibilidade Luumu{projectName ? ` · configuração salva de ${projectName}` : " · configuração padrão"} · plataforma fictícia
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <DemoBtn onClick={() => widget()?.open("nudge")} icon={<Megaphone className="size-3.5" />}>Ver convite</DemoBtn>
            <DemoBtn onClick={() => widget()?.open("libras")} icon={<Hand className="size-3.5" />}>Libras</DemoBtn>
            <DemoBtn onClick={() => widget()?.open("face")} icon={<ScanFace className="size-3.5" />}>Navegação por rosto</DemoBtn>
            <DemoBtn onClick={reset} icon={<RotateCcw className="size-3.5" />}>Recomeçar</DemoBtn>
          </div>
        </div>
      )}

      <div className="flex">
        {/* menu lateral */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-[#E5E7EB] bg-white px-4 py-6 md:flex">
          <a href="#" className="mb-8 flex items-center gap-2.5 px-2" aria-label="Escola Aurora, página inicial">
            <span className="grid size-10 place-items-center rounded-xl bg-[#312E81] text-white">
              <GraduationCap className="size-5" />
            </span>
            <span className="leading-tight">
              <strong className="block text-[15px] tracking-tight">Escola Aurora</strong>
              <span className="text-xs text-[#64748B]">Plataforma de estudos</span>
            </span>
          </a>
          <nav aria-label="Menu principal" className="flex flex-col gap-1">
            {NAV.map((n) => (
              <a key={n.label} href="#" aria-current={n.on ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium ${n.on ? "bg-[#4F46E5] text-white" : "text-[#334155] hover:bg-[#F1F5F9]"}`}>
                <n.icon className="size-5" /> {n.label}
              </a>
            ))}
            <p className="mb-1 mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Ferramentas</p>
            {TOOLS.map((n) => (
              <a key={n.label} href="#" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium text-[#334155] hover:bg-[#F1F5F9]">
                <n.icon className="size-5" /> {n.label}
              </a>
            ))}
          </nav>
          <div className="mt-auto flex items-center gap-3 rounded-2xl border border-[#E5E7EB] p-3">
            <span className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-[#F59E0B] to-[#E11D48] text-sm font-bold text-white">AS</span>
            <span className="min-w-0 leading-tight">
              <strong className="block truncate text-sm">Ana Souza</strong>
              <span className="text-xs text-[#64748B]">1ª série B</span>
            </span>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-5 py-8 md:px-10">
          <header className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-[#64748B]">Bom dia, Ana 👋</p>
              <h1 className="text-[28px] font-extrabold tracking-tight">Para você</h1>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF7ED] px-3 py-1.5 text-sm font-bold text-[#C2410C]">
              <Flame className="size-4 animate-pulse" /> 6 dias seguidos
            </span>
          </header>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="flex min-w-0 flex-col gap-6">
              {/* destaque */}
              <section className="relative overflow-hidden rounded-3xl bg-[#1E1B4B] p-8 text-white">
                <div className="absolute -right-10 -top-16 size-64 animate-[spin_24s_linear_infinite] rounded-full border-[28px] border-[#F59E0B]/40" aria-hidden />
                <div className="absolute -bottom-20 right-24 size-48 rounded-full bg-[#4F46E5]/50 blur-2xl" aria-hidden />
                <span className="relative inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wider">
                  <Sparkles className="size-3.5" /> Novo
                </span>
                <h2 className="relative mt-4 max-w-md text-[28px] font-extrabold leading-tight">Trilha de Aprofundamento em Ciências da Natureza</h2>
                <p className="relative mt-2 max-w-md text-white/80">As atividades da semana agora fazem parte do seu plano de estudos. Resolva e fortaleça as habilidades mais importantes.</p>
                <a href="#" className="relative mt-5 inline-flex items-center gap-2 rounded-xl bg-[#F59E0B] px-5 py-3 font-bold text-[#1E1B4B]">
                  Começar trilha <ChevronRight className="size-4" />
                </a>
              </section>

              {/* continuar */}
              <section>
                <h2 className="mb-3 text-[22px] font-extrabold tracking-tight">Continue aprendendo</h2>
                <article className="flex flex-col gap-5 rounded-3xl border border-[#E5E7EB] bg-white p-5 md:flex-row">
                  <div className="grid h-44 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#FEF3C7] to-[#FDE68A] md:w-64" aria-hidden>
                    <svg viewBox="0 0 120 90" className="h-28">
                      <rect x="18" y="20" width="60" height="44" rx="4" fill="#fff" stroke="#B45309" strokeWidth="3" />
                      <path d="M26 54l14-16 10 10 8-6 12 12" fill="none" stroke="#4F46E5" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="62" cy="32" r="5" fill="#F59E0B" />
                      <path d="M48 64l-10 18M48 64l10 18" stroke="#B45309" strokeWidth="3" strokeLinecap="round" />
                      <rect x="84" y="40" width="8" height="40" rx="3" fill="#E11D48" transform="rotate(12 88 60)" />
                      <rect x="96" y="44" width="8" height="36" rx="3" fill="#0EA5E9" transform="rotate(-8 100 62)" />
                    </svg>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="text-sm font-semibold uppercase tracking-wider text-[#64748B]">Curso</p>
                    <h3 className="mt-1 text-xl font-extrabold">Artes – Ensino Médio</h3>
                    <p className="mt-1.5 text-[#475569]">Desenvolva repertório cultural e senso crítico por meio da análise de obras, movimentos artísticos e contextos históricos.</p>
                    <div className="mt-auto flex items-center gap-3 pt-4">
                      <div className="h-2 flex-1 rounded-full bg-[#E2E8F0]" role="progressbar" aria-valuenow={28} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso do curso">
                        <div className="h-2 w-[28%] rounded-full bg-[#4F46E5]" />
                      </div>
                      <span className="text-sm font-semibold text-[#475569]">28%</span>
                    </div>
                    <button type="button" className="mt-4 rounded-xl bg-[#4F46E5] py-3 font-bold text-white hover:bg-[#4338CA]">Ir para o curso</button>
                  </div>
                </article>
              </section>

              {/* leitura (para testar leitor de texto, Libras, tamanho e espaçamento) */}
              <section className="rounded-3xl border border-[#E5E7EB] bg-white p-6">
                <p className="text-sm font-semibold uppercase tracking-wider text-[#B45309]">Leitura do dia · História</p>
                <h2 className="mt-1 text-[22px] font-extrabold tracking-tight">A Revolução Industrial e as cidades</h2>
                <p className="mt-3 leading-relaxed text-[#334155]">
                  A Revolução Industrial começou na Inglaterra, no século XVIII, e mudou a forma como as pessoas trabalhavam. As máquinas a vapor
                  permitiram produzir muito mais em menos tempo, e as fábricas passaram a reunir centenas de trabalhadores no mesmo lugar.
                </p>
                <p className="mt-3 leading-relaxed text-[#334155]">
                  Com as fábricas, muitas famílias saíram do campo e foram morar nas cidades. Elas cresceram rápido demais: faltavam moradia,
                  saneamento e transporte, e as jornadas de trabalho chegavam a quatorze horas por dia.
                </p>
                <p className="mt-3 leading-relaxed text-[#334155]">
                  Foi nesse cenário que surgiram os primeiros sindicatos e as leis que limitaram o trabalho infantil. Muitas conquistas que
                  conhecemos hoje começaram nessa época.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <a href="#" className="text-[15px] font-semibold text-[#4F46E5]">Ver a videoaula</a>
                  <span className="text-[#CBD5E1]">·</span>
                  <a href="#" className="text-[15px] font-semibold text-[#4F46E5]">Fazer os exercícios</a>
                </div>
              </section>
            </div>

            {/* próximas aulas */}
            <aside className="flex flex-col gap-3" aria-label="Próximas aulas">
              <h2 className="text-[18px] font-extrabold tracking-tight">Próximas aulas</h2>
              {NEXT.map((n) => (
                <a key={n.topic} href="#" className="flex items-stretch gap-3 rounded-2xl border border-[#E5E7EB] bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                  <span className="w-1 rounded-full" style={{ background: n.color }} />
                  <span className="min-w-0">
                    <span className="block text-xs font-bold uppercase tracking-wider text-[#64748B]">{n.subject}</span>
                    <span className="block text-[15px] font-medium">{n.topic}</span>
                  </span>
                </a>
              ))}
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}

function DemoBtn({ onClick, icon, children }: { onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20">
      {icon}
      {children}
    </button>
  );
}
