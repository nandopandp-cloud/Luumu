export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && (
          <span className="mb-2 inline-flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            <span className="h-0.5 w-5 rounded-full [background:var(--grad-marca)]" />
            {eyebrow}
          </span>
        )}
        <h1 className="font-display text-2xl font-extrabold tracking-tight md:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-fg-mut">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
