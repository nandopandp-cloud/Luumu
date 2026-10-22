# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Project layout

Source lives in `src/` (`@/` → `src/`). Before adding a file, a table, an endpoint or a module, read `docs/ARQUITETURA.md`: it maps each kind of change to its folder and lists the conventions (server-only vs pure modules, project scoping, generated files).

Verify changes with `pnpm exec tsc --noEmit`, `pnpm test` and `pnpm lint`.
