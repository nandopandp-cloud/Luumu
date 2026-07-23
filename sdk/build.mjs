import { build } from "esbuild";

// Compila o SDK vanilla para public/sdk.js (IIFE minificado, sem dependências).
await build({
  entryPoints: ["sdk/luumu.ts"],
  outfile: "public/sdk.js",
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2018"],
  legalComments: "none",
});

console.log("✓ SDK compilado → public/sdk.js");
