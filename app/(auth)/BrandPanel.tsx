import { Heart, Smile, Meh, Frown, Target, BarChart3, Sparkles, ShieldCheck } from "lucide-react";
import { Mascot } from "@/components/ui/Mascot";
import { csatTrend, npsTrend } from "@/lib/mock/dashboard";

const feedbacks = [
  { icon: Smile, tone: "bg-luumu-verde/15 text-[#2F8F3F]", text: "Muito fácil de usar!", when: "Hoje, 10:24" },
  { icon: Meh, tone: "bg-[#FBBF24]/15 text-[#B45309]", text: "A plataforma nos ajudou muito", when: "Hoje, 09:15" },
  { icon: Frown, tone: "bg-erro/15 text-erro", text: "Seria ótimo ter mais relatórios", when: "Ontem, 16:42" },
];

const features = [
  { icon: Target, label: "Pesquisas Inteligentes" },
  { icon: BarChart3, label: "Insights Automáticos" },
  { icon: Sparkles, label: "IA que entende seus clientes" },
  { icon: ShieldCheck, label: "Segurança e conformidade" },
];

/** Sparkline SVG minimalista para o card de CSAT do painel de marca. */
function Sparkline({ points }: { points: number[] }) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const w = 100;
  const h = 32;
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((p - min) / span) * h;
    return [x, y] as const;
  });
  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lastX, lastY] = coords[coords.length - 1];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-full overflow-visible" preserveAspectRatio="none">
      <path d={path} fill="none" stroke="var(--luumu-roxo-claro)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r={3} className="fill-white" />
    </svg>
  );
}

export function BrandPanel({
  mascotName = "Feliz",
}: {
  mascotName?: React.ComponentProps<typeof Mascot>["name"];
}) {
  const csat = csatTrend[csatTrend.length - 1].csat;
  const nps = npsTrend[npsTrend.length - 1].nps;

  return (
    <div className="relative hidden overflow-hidden lg:block [background:var(--luumu-roxo-escuro)]">
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,.12) 1px, transparent 0)",
          backgroundSize: "26px 26px",
        }}
      />
      <div
        className="pointer-events-none absolute -right-40 -top-40 size-[560px] rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--luumu-roxo-claro) 0%, transparent 70%)" }}
      />

      <div className="relative z-10 flex h-full flex-col justify-between px-10 py-12 xl:px-16 xl:py-16">
        {/* Headline */}
        <div className="max-w-md">
          <h2 className="font-display text-4xl font-extrabold leading-[1.1] text-white xl:text-5xl">
            Ouça.
            <br />
            Entenda.
            <br />
            <span className="text-luumu-verde">Melhore.</span>
          </h2>
          <p className="mt-4 max-w-sm text-white/70">
            A plataforma de Voice of Customer que transforma feedback em crescimento real.
          </p>
        </div>

        {/* Mascote + cards flutuantes */}
        <div className="relative mx-auto min-h-[340px] w-full max-w-md">
          {/* CSAT card */}
          <div className="absolute right-0 top-0 z-10 w-44 rounded-2xl border border-white/10 bg-[#4B1CAB] p-4 text-white shadow-xl">
            <p className="text-xs font-medium text-white/70">CSAT Médio</p>
            <p className="mt-1 font-display text-3xl font-extrabold">{csat.toFixed(1)}</p>
            <p className="mt-1 text-xs font-semibold text-luumu-verde">↑ 8% desde o mês passado</p>
            <Sparkline points={csatTrend.map((d) => d.csat)} />
          </div>

          {/* Mascote central */}
          <div className="relative flex justify-center py-6">
            <Mascot name={mascotName} size={210} float />
            <div className="absolute left-[26%] top-4 grid size-9 place-items-center rounded-full bg-luumu-verde shadow-lg">
              <Heart className="size-4 fill-[#0A2E12] text-[#0A2E12]" />
            </div>
          </div>

          {/* NPS card */}
          <div className="absolute right-0 top-44 w-48 rounded-2xl border border-line bg-white p-4 text-[#1A1A2E] shadow-xl">
            <p className="text-xs font-medium text-fg-mut">NPS</p>
            <p className="mt-1 font-display text-3xl font-extrabold">{nps}</p>
            <p className="mt-1 text-xs font-semibold text-[#2F8F3F]">↑ 9 pontos desde o mês passado</p>
            <div className="mt-2 h-1.5 w-full rounded-full [background:linear-gradient(90deg,#EF4444_0%,#FBBF24_50%,#7ED957_100%)]" />
          </div>

          {/* Respostas hoje */}
          <div className="absolute bottom-0 left-0 z-10 w-40 rounded-2xl border border-white/10 bg-[#4B1CAB] p-4 text-white shadow-xl">
            <p className="text-xs font-medium text-white/70">Respostas hoje</p>
            <p className="mt-1 font-display text-2xl font-extrabold">128</p>
            <p className="mt-0.5 text-xs font-semibold text-luumu-verde">↑ 18%</p>
            <div className="mt-2 flex h-8 items-end gap-1">
              {[40, 55, 35, 65, 50, 80, 70].map((v, i) => (
                <span key={i} className="flex-1 rounded-t bg-white/60" style={{ height: `${v}%` }} />
              ))}
            </div>
          </div>
        </div>

        {/* Feedback recente */}
        <div className="mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-white/10 p-4 text-white shadow-xl backdrop-blur-md">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">Feedback recente</p>
            <span className="text-xs font-medium text-white/60">Ver todos</span>
          </div>
          <ul className="flex flex-col gap-3">
            {feedbacks.map(({ icon: Icon, tone, text, when }) => (
              <li key={text} className="flex items-center gap-3">
                <span className={`grid size-8 shrink-0 place-items-center rounded-full ${tone}`}>
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{text}</p>
                  <p className="text-xs text-white/50">{when}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Features */}
        <div className="mx-auto mt-8 grid w-full max-w-md grid-cols-2 gap-3">
          {features.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2.5 text-white/90">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10">
                <Icon className="size-4" />
              </span>
              <span className="text-sm font-medium leading-tight">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
