"use client";

import { useEffect, useState } from "react";
import { CodeBlock } from "@/components/ui/CodeBlock";

/** Snippets de instalação que usam a origem real do app em runtime. */
export function InstallSnippets({ sdkKey }: { sdkKey: string }) {
  const [origin, setOrigin] = useState("https://luumu-five.vercel.app");
  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const script = `<!-- Cole antes do </head> do seu produto -->
<script
  src="${origin}/sdk.js"
  data-luumu="${sdkKey}"
  defer
></script>`;

  const programmatic = `<script src="${origin}/sdk.js"></script>
<script>
  Luumu.init({ key: "${sdkKey}" });

  // exibir uma pesquisa específica (ex.: em um clique):
  // Luumu.show("svy_xxx");
</script>`;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div>
        <div className="mb-2 text-sm font-semibold text-fg-soft">Instalação (recomendada)</div>
        <CodeBlock code={script} lang="html" />
      </div>
      <div>
        <div className="mb-2 text-sm font-semibold text-fg-soft">Controle programático</div>
        <CodeBlock code={programmatic} lang="html" />
      </div>
    </div>
  );
}
