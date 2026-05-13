import dotenv from "dotenv";
import { readFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

dotenv.config({ path: join(root, ".env") });
dotenv.config({ path: join(root, ".env.local") });
const migrationsDir = join(root, "db", "migrations");

function getDatabaseUrl() {
  const direct = process.env.DATABASE_URL?.trim();
  if (direct) return direct;

  const host = process.env.DB_HOST?.trim();
  const port = process.env.DB_PORT?.trim() || "5432";
  const name = process.env.DB_NAME?.trim();
  const user = process.env.DB_USER?.trim();
  const pass = process.env.DB_PASSWORD ?? "";

  if (!host || !name || !user) {
    console.error("Set DATABASE_URL or DB_HOST, DB_NAME, DB_USER in .env");
    process.exit(1);
  }

  const encUser = encodeURIComponent(user);
  const encPass = encodeURIComponent(pass);
  const ssl = process.env.DB_SSL === "true" || process.env.DB_SSL === "1";
  const sslMode = ssl ? "require" : process.env.DB_SSLMODE?.trim() || "disable";
  return `postgresql://${encUser}:${encPass}@${host}:${port}/${name}?sslmode=${sslMode}`;
}

async function waitForDatabase(maxAttempts = 20, delayMs = 3000) {
  const url = getDatabaseUrl();
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const testPool = new pg.Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 5000 });
      await testPool.query("SELECT 1");
      await testPool.end();
      return;
    } catch (err) {
      if (attempt === maxAttempts) {
        console.error(`Database did not become available after ${maxAttempts} attempts.`);
        throw err;
      }
      console.log(`Waiting for database connection... (${attempt}/${maxAttempts})`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

await waitForDatabase();

const files = (await readdir(migrationsDir))
  .filter((f) => f.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  console.error("No .sql files in db/migrations");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: getDatabaseUrl() });

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const { rows: countRows } = await pool.query(`SELECT count(*)::int AS c FROM public.schema_migrations`);
  const appliedCount = countRows[0]?.c ?? 0;

  if (appliedCount === 0) {
    const { rows: existsRows } = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'bookings'
      ) AS e
    `);
    if (existsRows[0]?.e) {
      for (const name of files) {
        await pool.query(
          `INSERT INTO public.schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING`,
          [name],
        );
      }
      console.log(
        "Detected existing public.bookings (schema already present). Recorded current migration files as applied without re-running SQL.",
      );
      await pool.end();
      process.exit(0);
    }
  }

  let ran = 0;
  for (const name of files) {
    const { rows: done } = await pool.query(
      `SELECT 1 FROM public.schema_migrations WHERE filename = $1 LIMIT 1`,
      [name],
    );
    if (done.length > 0) {
      console.log(`→ ${name} … skip (already applied)`);
      continue;
    }

    const sql = await readFile(join(migrationsDir, name), "utf8");
    process.stdout.write(`→ ${name} … `);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(`INSERT INTO public.schema_migrations (filename) VALUES ($1)`, [name]);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
    console.log("ok");
    ran += 1;
  }

  if (ran === 0) {
    console.log("Nothing new to apply.");
  } else {
    console.log(`Done (${ran} migration(s) applied).`);
  }
} catch (e) {
  console.error("\nMigration failed:", e.message || e);
  process.exit(1);
} finally {
  await pool.end();
}
