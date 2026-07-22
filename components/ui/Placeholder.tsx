import { PageHeader } from "./PageHeader";
import { EmptyState } from "./EmptyState";
import type { MascotName } from "./Mascot";

/** Placeholder temporário para telas ainda em construção neste protótipo. */
export function Placeholder({
  eyebrow,
  title,
  description,
  mascot = "Trabalhando",
}: {
  eyebrow: string;
  title: string;
  description: string;
  mascot?: MascotName;
}) {
  return (
    <div>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <EmptyState
        mascot={mascot}
        title="Em construção neste protótipo"
        description="Esta área faz parte do escopo e será detalhada em seguida."
      />
    </div>
  );
}
