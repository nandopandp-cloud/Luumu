import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// carrega .env.local (Next.js usa esse arquivo; dotenv por padrão lê só .env)
config({ path: ".env.local" });

// migrations/seed usam a conexão não-pooled (direta)
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL!;

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: { url },
  verbose: true,
  strict: true,
});
