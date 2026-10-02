/** "Distribuição de notas": barras verticais da nota mais baixa (vermelho) à mais alta (verde). */
const SCALE = ["#EF4444", "#FB923C", "#FACC15", "#86EFAC", "#22C55E"];

function colorAt(i: number, n: number) {
  if (n <= 1) return SCALE[SCALE.length - 1];
  return SCALE[Math.round((i / (n - 1)) * (SCALE.length - 1))];
}

export function DistributionBars({ buckets, total }: { buckets: { label: string; value: number }[]; total: number }) {
  const asc = [...buckets].reverse(); // vem da maior para a menor
  const max = Math.max(1, ...asc.map((b) => b.value));
  const dense = asc.length > 7; // NPS 0–10: rótulos menores
  return (
    <section className="flex h-full flex-col rounded-2xl border border-line bg-bg-elev p-6 shadow-[var(--shadow-sm)]">
      <h2 className="font-display text-lg font-bold tracking-tight">Distribuição de notas</h2>
      <p className="mt-0.5 text-sm text-fg-mut">Base: {total.toLocaleString("pt-BR")} respostas</p>
      {total === 0 ? (
        <div className="flex flex-1 items-center justify-center py-12 text-sm text-fg-mut">Sem respostas no período.</div>
      ) : (
        <div className="mt-6 flex min-h-[200px] flex-1 items-end gap-2 sm:gap-3" role="img" aria-label={asc.map((b) => `nota ${b.label}: ${b.value}%`).join(", ")}>
          {asc.map((b, i) => (
            <div key={b.label} className="flex h-full flex-1 flex-col items-center justify-end">
              <span className={`mb-1.5 font-semibold text-fg-soft ${dense ? "text-[10px]" : "text-xs"}`}>{b.value}%</span>
              <div
                className="w-full max-w-[52px] rounded-t-lg transition-all"
                style={{ height: `${Math.max(3, (b.value / max) * 150)}px`, background: colorAt(i, asc.length) }}
              />
              <span className={`mt-2 font-mono font-semibold text-fg-mut ${dense ? "text-[10px]" : "text-xs"}`}>{b.label}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
