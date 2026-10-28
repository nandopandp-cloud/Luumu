/*
  Carrega o .env.local. Importe ANTES de qualquer módulo de src/: os imports rodam antes do corpo
  do script, então chamar config() no script chega tarde para lib/db/client.ts, que lê
  DATABASE_URL ao ser importado.
*/
import { config } from "dotenv";

config({ path: ".env.local" });
