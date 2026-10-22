# Custos do Neon — diagnóstico e ações

O Neon cobra basicamente quatro coisas: **compute** (CU × horas com a compute ligada),
**armazenamento** (dados + índices), **histórico** (WAL guardado para restauração/branches) e
**transferência** (dados que saem do banco). Este documento lista o que já foi feito no código
e o que só pode ser feito no console.

## Por que a compute quase nunca dorme

O SDK roda em todas as páginas dos sites dos clientes e grava ao sair de cada página
(`/api/v1/collect`, `/api/v1/tours/events`...). Com tráfego 24 h, o *scale to zero* do Neon
(suspensão após 5 min sem consultas) praticamente não acontece. Por isso, o que define a conta
de compute é **o tamanho da compute enquanto ela está ligada** — e consultas pesadas fazem o
autoscaling subir de CU. Reduzir picos de CPU é o que mais economiza.

## O que mudou no código (migração `0036_neon_cost.sql`)

| Mudança | Onde | Efeito |
| --- | --- | --- |
| Soma de "eventos do mês" com cache dos dias encerrados | `src/lib/db/workspace.ts` | A consulta lia do heap **todas as telas do mês** a cada carregamento do app e a cada atualização do medidor de uso. Agora só o dia de hoje é relido. |
| Cache do uso compartilhado entre o layout e `/api/usage` | `src/lib/db/workspace.ts`, `src/app/(app)/layout.tsx`, `src/app/api/usage/route.ts` | O layout refazia as 4 contagens a cada página carregada, sem cache. |
| Usuário do Analytics só é regravado quando muda | `src/lib/db/analytics.ts` (`recordAnalytics`) | Antes, cada envio do SDK reescrevia a linha em `analytics_users` (~1/3 das escritas da ingestão). Agora só regrava se a identidade mudar ou a última visita avançar mais de 10 min. A hora exata continua vindo das sessões (a lista e o perfil usam o maior valor entre os dois). |
| Índice `analytics_users_name_idx` | migração 0036 | `personal()` procurava, linha a linha, outra pessoa com o mesmo nome percorrendo todos os usuários do projeto (custo quadrático na lista de usuários). |
| Recorte de data em "novos usuários → resultado" | `src/lib/db/analytics.ts` (`newUserOutcomes`) | Deixa o Postgres usar o índice `(project_id, created_at)` em vez de ler todas as telas do projeto. |
| Retenção de `analytics_users` | `src/lib/db/retention.ts` | A tabela só crescia. Usuários sem visita além da retenção do plano saem junto com as sessões deles. A limpeza das sessões passou a usar o índice. |
| Heatmap: só a cópia usada é baixada | `src/lib/db/heatmaps.ts` (`getSnapshot`) | Antes vinham os HTMLs de todos os dispositivos para usar um. |
| Remoção de índices redundantes e da tabela `rate_limits` | migração 0036 | Menos escrita, WAL e espaço em toda gravação. |

### Rodada 2 (21/10/2026) — cache compartilhado entre instâncias

Medido no `pg_stat_statements` (30 h, compute sem suspender nenhuma vez): a contagem de sessões
de heatmap do mês (`heatmapQuota`) somava **878 s de CPU em 30 h** (1.094 chamadas × ~800 ms,
~270 GB de páginas lidas) — mais que todas as outras consultas juntas. O cache em memória de
5 min valia por instância da função de coleta, e cada instância nova refazia a leitura do mês.

| Mudança | Onde | Efeito medido |
| --- | --- | --- |
| `sharedCache` (`unstable_cache` do Next) | `src/lib/db/shared-cache.ts` | Cache compartilhado entre todas as instâncias e deploys na Vercel. |
| Cota de heatmap: dias encerrados no cache compartilhado (1×/dia), só hoje relido | `src/lib/db/heatmaps.ts` | 400–800 ms → 30–100 ms por recálculo. |
| Estimativa de sessões/24h do `heatmapPlan` no cache compartilhado (10 min) | `src/lib/db/heatmaps.ts` | 2.441 chamadas/30 h → no máximo 1 a cada 10 min por projeto. |
| Eventos do mês: dias encerrados no cache compartilhado; hoje com 5 min | `src/lib/db/workspace.ts` | ~4–5 s → ~250 ms, e o dia fechado 1×/dia em vez de 1× por instância. |

### Piso do custo: a compute nunca dorme

Tráfego de madrugada (1h–6h BRT): 100–250 telas/hora, intervalos acima de 5 min são raros.
Com a compute sempre ligada, o **mínimo** é `CU mínima × 24 h × 30` — a 0,25 CU, ~183 CU-h ≈
US$ 19/mês. Tudo acima disso vem da compute escalando por consultas pesadas, que é o que estas
mudanças atacam. Para ficar abaixo do piso seria preciso a compute dormir de madrugada
(enfileirar a ingestão fora do Postgres) — economiza ~US$ 4/mês e exige um serviço de fila
pago; não compensa hoje.

### Aplicar a migração

Rode `drizzle/0036_neon_cost.sql` no SQL Editor do Neon, **um comando por vez**
(`CONCURRENTLY` não roda dentro de transação). Nenhum comando trava a ingestão.

## O que fazer no console do Neon (maior impacto)

1. **Histórico (restore window / history retention)** — *Project settings → Storage / Instant restore*.
   Com ingestão contínua, cada dia de histórico guarda todo o WAL do dia. Reduzir de 7 (ou 30)
   para **1 dia** costuma ser a maior economia de armazenamento. O preço: só dá para restaurar
   o banco para um ponto até 24 h atrás.
2. **Autoscaling** — *Branches → main → Compute → Edit*. Defina um teto (ex.: mín. 0,25 CU,
   máx. 1–2 CU). Sem teto baixo, uma consulta pesada do painel sobe a compute e ela demora a descer.
   Em 21/10/2026 o `effective_cache_size` da compute (25,6 GB) indicava teto de ~8 CU.
3. **Branches de preview** — a integração Neon + Vercel cria um branch (com compute própria)
   por deploy de preview. Apague os antigos em *Branches* e ative a exclusão automática na
   integração. Branches parados também guardam histórico.
4. **Computes de leitura/réplicas** que não são usadas: o app só usa `DATABASE_URL`.
5. **Scale to zero** ligado em todos os branches que não são `main` (5 min).

## Diagnóstico (SQL Editor do Neon)

```sql
-- consultas que mais gastam tempo de CPU (precisa da extensão; no Neon basta criar)
create extension if not exists pg_stat_statements;
select round(total_exec_time) ms_total, calls, round(mean_exec_time::numeric, 1) ms_media,
       rows, left(regexp_replace(query, '\s+', ' ', 'g'), 160) consulta
  from pg_stat_statements order by total_exec_time desc limit 20;

-- tamanho de cada tabela (dados + índices)
select relname tabela, pg_size_pretty(pg_total_relation_size(relid)) total,
       pg_size_pretty(pg_relation_size(relid)) dados, n_live_tup linhas, n_dead_tup mortas
  from pg_stat_user_tables order by pg_total_relation_size(relid) desc;

-- índices nunca usados (candidatos a remoção — confira antes; reinicia a cada restart da compute)
select relname tabela, indexrelname indice, pg_size_pretty(pg_relation_size(indexrelid)) tamanho, idx_scan
  from pg_stat_user_indexes where idx_scan = 0 order by pg_relation_size(indexrelid) desc;
```

## Próximos passos possíveis (avaliar com o diagnóstico acima)

- **Perfil do usuário no Analytics** (`getAnalyticsUserProfile`): as telas e eventos de um
  usuário são buscadas por `(project_id, anon_id)`, que não tem índice em
  `analytics_pageviews` — cada perfil aberto percorre as telas do projeto. Um índice
  `(project_id, anon_id, created_at)` resolve, mas aumenta escrita e espaço na tabela mais
  gravada. Vale se o perfil aparecer no topo do `pg_stat_statements`.
- **Retenção de `tour_events`**: hoje nunca é limpa. Volume baixo; aplicar a retenção do plano
  mudaria os totais "desde sempre" dos tours antigos, por isso ficou de fora.
