/** Cabeçalho da área: título, explicação e o mascote com um balão de contexto. */
export function InsightsHeader({ periodLabel, variant = "dashboard" }: { periodLabel: string; variant?: "dashboard" | "chat" }) {
  const chat = variant === "chat";
  return (
    <header className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="max-w-3xl">
        <span className="inline-flex rounded-md bg-surface-brand px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-accent">
          Insights IA
        </span>
        <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight md:text-[34px] md:leading-tight">
          {chat ? "Converse com seus dados e transforme feedbacks em decisões." : "Transforme feedbacks em decisões"}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-fg-mut">
          {chat
            ? "A Luumu analisa suas respostas, identifica padrões e traz recomendações claras para você."
            : "A Luumu analisa suas respostas, identifica padrões e traz recomendações claras para você entender o que está acontecendo e o que fazer em seguida."}
        </p>
      </div>
      <div className="hidden shrink-0 items-center gap-1 md:flex" aria-hidden>
        <div className="relative max-w-[220px] rounded-2xl border border-accent/15 bg-bg-elev px-4 py-3 text-sm font-medium leading-snug text-accent shadow-[0_8px_24px_rgba(75,28,171,.10)]">
          {chat
            ? "Estou aqui para ajudar você a entender o que está acontecendo com os seus usuários! ✨"
            : `Aqui estão os principais insights dos seus feedbacks dos ${periodLabel}! ✨`}
          <span className="absolute -right-1.5 top-1/2 size-3 -translate-y-1/2 rotate-45 border-r border-t border-accent/15 bg-bg-elev" />
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- imagem estática já otimizada */}
        <img src="/mascot/mascote-card.webp" alt="" width={150} height={117} className="w-[150px] drop-shadow-[0_12px_24px_rgba(75,28,171,.22)]" />
      </div>
    </header>
  );
}
