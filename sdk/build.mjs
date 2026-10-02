import { build } from "esbuild";

/*
  Compila os bundles do SDK (IIFE minificado, sem dependências):
   - public/sdk.js          core: pesquisas, eventos e a ponte dos tours (carregado em toda página)
   - public/sdk-tours.js    runtime dos tours (só quando há tour elegível)
   - public/sdk-builder.js  overlay do builder (só na aba do administrador)
  `__LUUMU_BUILD__` versiona a URL dos dois últimos: o core pede `sdk-tours.js?v=<build>`,
  então um deploy novo nunca mistura core novo com runtime velho em cache.
*/
const BUILD = Date.now().toString(36);
const common = {
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2018"],
  legalComments: "none",
  define: { __LUUMU_BUILD__: JSON.stringify(BUILD) },
};

const bundles = [
  ["sdk/luumu.ts", "public/sdk.js"],
  ["sdk/tours/runtime.ts", "public/sdk-tours.js"],
  ["sdk/builder/builder.ts", "public/sdk-builder.js"],
];

const results = await Promise.all(
  bundles.map(([entry, outfile]) => build({ ...common, entryPoints: [entry], outfile, metafile: true }))
);
for (const [i, r] of results.entries()) {
  const [file, info] = Object.entries(r.metafile.outputs)[0];
  console.log(`✓ ${bundles[i][0]} → ${file} (${(info.bytes / 1024).toFixed(1)} KB)`);
}
