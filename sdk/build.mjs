import { build } from "esbuild";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

/*
  Compila os bundles do SDK (IIFE minificado, sem dependências):
   - public/sdk-tours.js    runtime dos tours (só quando há tour elegível)
   - public/sdk-builder.js  overlay do builder (só na aba do administrador)
   - public/sdk-heatmaps.js gravador de heatmaps (só em projetos com a coleta ativa)
   - public/sdk.js          core: pesquisas, eventos e a ponte dos tours (carregado em toda página)

  Versão dos bundles sob demanda = hash do CONTEÚDO deles, gravado em
  lib/tours/sdk-version.ts e anunciado pelo /config. Não pode ser só uma constante dentro do
  sdk.js: o core fica em cache no navegador por até 1h, e um core velho pediria o runtime
  velho (cacheado como imutável) — o deploy novo não chegaria a quem já visitou o site.
*/
const common = { bundle: true, minify: true, format: "iife", target: ["es2018"], legalComments: "none", metafile: true };

const lazy = [
  ["sdk/tours/runtime.ts", "public/sdk-tours.js"],
  ["sdk/builder/builder.ts", "public/sdk-builder.js"],
  ["sdk/heatmaps/recorder.ts", "public/sdk-heatmaps.js"],
];
const lazyResults = await Promise.all(lazy.map(([entry, outfile]) => build({ ...common, entryPoints: [entry], outfile })));

const hash = createHash("sha1");
for (const [, outfile] of lazy) hash.update(readFileSync(outfile));
const VERSION = hash.digest("hex").slice(0, 10);
writeFileSync(
  "lib/tours/sdk-version.ts",
  `// Gerado por sdk/build.mjs — não editar. Hash do conteúdo de sdk-tours.js + sdk-builder.js + sdk-heatmaps.js.\nexport const SDK_BUNDLE_VERSION = "${VERSION}";\n`
);

const core = await build({
  ...common,
  entryPoints: ["sdk/luumu.ts"],
  outfile: "public/sdk.js",
  define: { __LUUMU_BUILD__: JSON.stringify(VERSION) },
});

for (const r of [...lazyResults, core]) {
  const [file, info] = Object.entries(r.metafile.outputs)[0];
  console.log(`✓ ${file} (${(info.bytes / 1024).toFixed(1)} KB)`);
}
console.log(`  versão dos bundles sob demanda: ${VERSION}`);
