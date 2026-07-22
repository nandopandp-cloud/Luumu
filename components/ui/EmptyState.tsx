import { Mascot, type MascotName } from "./Mascot";

export function EmptyState({
  mascot = "Pensativo",
  title,
  description,
  action,
}: {
  mascot?: MascotName;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-bg-elev/50 px-6 py-14 text-center">
      <Mascot name={mascot} size={110} float />
      <h3 className="mt-5 text-lg font-bold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-fg-mut">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
