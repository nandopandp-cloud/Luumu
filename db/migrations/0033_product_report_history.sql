-- Histórico do Report Quinzenal importado da planilha "North Star" (abas Q1/Q2 de abr–set/2026).
-- Entra como valores informados (source "planilha"), usados só onde a Luumu não tiver o dado
-- da quinzena, e como metas de cada quinzena. As abas de jan–abr/1 eram semanais e ficam de fora;
-- a planilha não tem Q1/Q2 de agosto nem Q1 de setembro.
--
-- Vai para o workspace principal (membership mais antiga) da conta autorizada no módulo, o mesmo
-- que a sessão dela usa. Sem a conta, não insere nada. Reexecutar não sobrescreve (DO NOTHING).
--
-- Q2ABRIL: a planilha digitou 15 min no tempo de uso consolidado (a média das plataformas é
-- 15,17), então a North Star recalculada aqui fica 96,55 em vez dos 96,21 da planilha.

INSERT INTO "product_report_periods" ("workspace_id", "period", "goals", "manual")
SELECT ws.workspace_id, v.period, v.goals::jsonb, v.manual::jsonb
FROM (
  SELECT m.workspace_id
  FROM "memberships" m
  JOIN "users" u ON u.id = m.user_id
  WHERE u.email = 'nandopandp@gmail.com'
  ORDER BY m.created_at, m.id
  LIMIT 1
) ws
CROSS JOIN (VALUES
  ('2026-04-2', '{"ns.csat":90,"ns.adherence":50,"ns.usage":15}', '{"educadores.adherence":{"value":51.78,"source":"planilha"},"educadores.usage":{"value":11,"source":"planilha"},"educadores.csat":{"value":81.5,"source":"planilha"},"exploradores.adherence":{"value":50.3,"source":"planilha"},"exploradores.usage":{"value":4.5,"source":"planilha"},"exploradores.csat":{"value":76.3,"source":"planilha"},"geniex.adherence":{"value":47.59,"source":"planilha"},"geniex.usage":{"value":30,"source":"planilha"}}'), -- Q2ABRIL: North Star 96.21
  ('2026-05-1', '{"ns.csat":90,"ns.adherence":50,"ns.usage":15}', '{"educadores.adherence":{"value":47.5,"source":"planilha"},"educadores.usage":{"value":10,"source":"planilha"},"educadores.csat":{"value":84.2,"source":"planilha"},"exploradores.adherence":{"value":43.7,"source":"planilha"},"exploradores.usage":{"value":4,"source":"planilha"},"exploradores.csat":{"value":82.6,"source":"planilha"},"geniex.adherence":{"value":43,"source":"planilha"},"geniex.usage":{"value":26,"source":"planilha"}}'), -- Q1MAIO: North Star 90.25
  ('2026-05-2', '{"ns.csat":95,"ns.adherence":50,"ns.usage":15}', '{"educadores.adherence":{"value":51.78,"source":"planilha"},"educadores.usage":{"value":10,"source":"planilha"},"educadores.csat":{"value":81.4,"source":"planilha"},"exploradores.adherence":{"value":46.9,"source":"planilha"},"exploradores.usage":{"value":5,"source":"planilha"},"exploradores.csat":{"value":94,"source":"planilha"},"geniex.adherence":{"value":45.7,"source":"planilha"},"geniex.usage":{"value":22,"source":"planilha"}}'), -- Q2MAIO: North Star 90.86
  ('2026-06-1', '{"ns.csat":95,"ns.adherence":50,"ns.usage":15}', '{"educadores.adherence":{"value":41.5,"source":"planilha"},"educadores.usage":{"value":10,"source":"planilha"},"educadores.csat":{"value":85.7,"source":"planilha"},"exploradores.adherence":{"value":32.88,"source":"planilha"},"exploradores.usage":{"value":4,"source":"planilha"},"exploradores.csat":{"value":87.7,"source":"planilha"},"geniex.adherence":{"value":49,"source":"planilha"},"geniex.usage":{"value":21,"source":"planilha"}}'), -- Q1JUNHO: North Star 83.61
  ('2026-06-2', '{"ns.csat":95,"ns.adherence":50,"ns.usage":15}', '{"educadores.adherence":{"value":40.6,"source":"planilha"},"educadores.usage":{"value":11,"source":"planilha"},"educadores.csat":{"value":77.9,"source":"planilha"},"exploradores.adherence":{"value":34.7,"source":"planilha"},"exploradores.usage":{"value":4,"source":"planilha"},"exploradores.csat":{"value":81.6,"source":"planilha"},"geniex.adherence":{"value":52,"source":"planilha"},"geniex.usage":{"value":24,"source":"planilha"}}'), -- Q2JUNHO: North Star 85.13
  ('2026-07-1', '{"ns.csat":95,"ns.adherence":50,"ns.usage":15}', '{"educadores.adherence":{"value":53.95,"source":"planilha"},"educadores.usage":{"value":10,"source":"planilha"},"educadores.csat":{"value":87.1,"source":"planilha"},"exploradores.adherence":{"value":35.4,"source":"planilha"},"exploradores.usage":{"value":4.3,"source":"planilha"},"exploradores.csat":{"value":86.1,"source":"planilha"},"geniex.adherence":{"value":59,"source":"planilha"},"geniex.usage":{"value":21,"source":"planilha"}}'), -- Q1JULHO: North Star 90.44
  ('2026-07-2', '{"ns.csat":95,"ns.adherence":50,"ns.usage":15}', '{"educadores.adherence":{"value":59,"source":"planilha"},"educadores.usage":{"value":10,"source":"planilha"},"educadores.csat":{"value":86.5,"source":"planilha"},"exploradores.adherence":{"value":39.7,"source":"planilha"},"exploradores.usage":{"value":4,"source":"planilha"},"exploradores.csat":{"value":85.1,"source":"planilha"},"geniex.adherence":{"value":62,"source":"planilha"},"geniex.usage":{"value":16,"source":"planilha"}}'), -- Q2JULHO: North Star 89.95
  ('2026-09-2', '{"ns.csat":95,"ns.adherence":50,"ns.usage":15}', '{"educadores.adherence":{"value":64,"source":"planilha"},"educadores.usage":{"value":13,"source":"planilha"},"educadores.csat":{"value":86.5,"source":"planilha"},"exploradores.adherence":{"value":43.7,"source":"planilha"},"exploradores.usage":{"value":5,"source":"planilha"},"exploradores.csat":{"value":78.9,"source":"planilha"},"geniex.adherence":{"value":65,"source":"planilha"},"geniex.usage":{"value":22,"source":"planilha"}}') -- Q2SETEMBRO: North Star 98.84
) AS v(period, goals, manual)
ON CONFLICT ("workspace_id", "period") DO NOTHING;
