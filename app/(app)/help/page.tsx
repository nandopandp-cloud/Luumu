import { HelpCenter } from "@/components/help/HelpCenter";

/** Central de Ajuda (FAQ). Conteúdo em lib/help/articles.ts. */
export default async function HelpPage({ searchParams }: { searchParams: Promise<{ c?: string; q?: string; a?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <HelpCenter initialCategory={sp.c} initialQuery={sp.q?.slice(0, 80)} initialArticle={sp.a} />
    </div>
  );
}
