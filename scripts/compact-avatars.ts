/**
 * Converte os avatares desenhados guardados inteiros (antes da migração 0040) para receita + peças
 * (lib/analytics/svg-parts.ts). Idempotente: desenho que já é receita fica como está, então dá para
 * interromper e rodar de novo. Lê em lotes pela chave primária (nunca a tabela inteira de uma vez).
 *
 * Ao final, o espaço só volta para o Neon depois de `VACUUM (FULL, ANALYZE) "avatar_svgs";` no SQL
 * Editor (de madrugada: trava a tabela por alguns segundos).
 *
 *   pnpm exec tsx --tsconfig scripts/tsconfig.scripts.json scripts/compact-avatars.ts          # simula
 *   pnpm exec tsx --tsconfig scripts/tsconfig.scripts.json scripts/compact-avatars.ts --apply  # aplica
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { and, asc, eq, gt, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { avatarSvgParts, avatarSvgs } from "@/lib/db/schema";
import { joinSvgParts, partHashes, splitSvgParts } from "@/lib/analytics/svg-parts";

const APPLY = process.argv.includes("--apply");
const BATCH = 200;

async function main() {
  let after: { projectId: string; hash: string } | null = null;
  const seen = new Set<string>();
  const total = { rows: 0, converted: 0, before: 0, after: 0, parts: 0 };

  for (;;) {
    const rows: { projectId: string; hash: string; svg: string }[] = await db
      .select({ projectId: avatarSvgs.projectId, hash: avatarSvgs.hash, svg: avatarSvgs.svg })
      .from(avatarSvgs)
      .where(after ? or(gt(avatarSvgs.projectId, after.projectId), and(eq(avatarSvgs.projectId, after.projectId), gt(avatarSvgs.hash, after.hash))) : undefined)
      .orderBy(asc(avatarSvgs.projectId), asc(avatarSvgs.hash))
      .limit(BATCH);
    if (!rows.length) break;
    after = rows[rows.length - 1];

    const updates: { projectId: string; hash: string; recipe: string }[] = [];
    const parts = new Map<string, { projectId: string; hash: string; body: string }>();
    for (const r of rows) {
      total.rows++;
      if (partHashes(r.svg).length) continue; // já convertido
      const { recipe, parts: own } = splitSvgParts(r.svg);
      if (!own.length) continue; // sem traçado grande (ex.: avatar que é só uma imagem embutida)
      // remontar tem que devolver exatamente o que estava guardado
      if (joinSvgParts(recipe, new Map(own.map((x) => [x.hash, x.body]))) !== r.svg) {
        console.warn(`pulado (não remonta igual): ${r.projectId}/${r.hash}`);
        continue;
      }
      updates.push({ projectId: r.projectId, hash: r.hash, recipe });
      total.converted++;
      total.before += r.svg.length;
      total.after += recipe.length;
      for (const x of own) {
        const key = `${r.projectId}/${x.hash}`;
        if (seen.has(key)) continue;
        seen.add(key);
        parts.set(key, { projectId: r.projectId, ...x });
        total.parts++;
        total.after += x.body.length;
      }
    }

    if (APPLY && updates.length) {
      const [first, ...rest] = updates.map((u) =>
        db.update(avatarSvgs).set({ svg: u.recipe }).where(and(eq(avatarSvgs.projectId, u.projectId), eq(avatarSvgs.hash, u.hash)))
      );
      // peças e receitas no mesmo lote (uma transação): nenhuma receita fica sem as peças
      await db.batch([
        first,
        ...rest,
        ...(parts.size ? [db.insert(avatarSvgParts).values([...parts.values()]).onConflictDoNothing()] : []),
      ]);
    }
    if (total.rows % 5000 < BATCH) console.log(`${total.rows} lidos, ${total.converted} convertidos`);
  }

  const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
  console.log(
    `${APPLY ? "Aplicado" : "Simulação"}: ${total.rows} desenhos, ${total.converted} convertidos, ${total.parts} peças. ` +
      `Texto ${mb(total.before)} → ${mb(total.after)}.`
  );
  if (APPLY) console.log('Agora rode no SQL Editor do Neon, de madrugada: VACUUM (FULL, ANALYZE) "avatar_svgs";');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
