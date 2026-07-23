import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL não configurada. Rode `vercel env pull` ou defina em .env.local.");
}

const sql = neon(url);
export const db = drizzle(sql, { schema });
export { schema };
