-- Retenção de 90 dias para heatmap_pageviews (controla custo de armazenamento e tráfego)
-- O painel de heatmaps mostra dados dos últimos 3 meses; Analytics fica intacto.

delete from heatmap_pageviews where created_at < now() - interval '90 days';
delete from heatmap_snapshots where created_at < now() - interval '90 days';

-- Índice para acelerar a limpeza (rodada diária)
create index if not exists heatmap_pageviews_created_at on heatmap_pageviews (created_at desc);
create index if not exists heatmap_snapshots_created_at on heatmap_snapshots (created_at desc);
