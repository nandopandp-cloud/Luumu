-- Autor da pesquisa, exibido na lista de pesquisas. Null = criada antes desta coluna existir.
ALTER TABLE "surveys" ADD COLUMN IF NOT EXISTS "created_by" text REFERENCES "users"("id") ON DELETE set null;
