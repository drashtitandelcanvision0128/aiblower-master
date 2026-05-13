import { Pool } from "pg";
import { getDatabaseUrl } from "@/lib/db/url";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const rawTimeout = Number(process.env.DB_CONNECT_TIMEOUT);
    const timeoutSec = Number.isFinite(rawTimeout) && rawTimeout > 0 ? rawTimeout : 10;
    pool = new Pool({
      connectionString: getDatabaseUrl(),
      max: Number(process.env.DB_POOL_SIZE) || 20,
      connectionTimeoutMillis: timeoutSec * 1000,
    });
  }
  return pool;
}
