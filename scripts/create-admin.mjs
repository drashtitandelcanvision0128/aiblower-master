import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: join(root, ".env") });
dotenv.config({ path: join(root, ".env.local") });

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

const email = process.argv[2]?.trim();
const password = process.argv[3] ?? "";

if (!email || !password) {
  console.error("Usage: npm run create-admin -- <email> <password>");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: getDatabaseUrl() });

try {
  const hash = bcrypt.hashSync(password, 12);
  await pool.query(`INSERT INTO admin_users (email, password_hash) VALUES ($1, $2)`, [email, hash]);
  console.log(`Admin created: ${email}`);
} catch (e) {
  if (e && typeof e === "object" && "code" in e && e.code === "23505") {
    console.error("That email is already registered.");
  } else {
    console.error(e);
  }
  process.exit(1);
} finally {
  await pool.end();
}
