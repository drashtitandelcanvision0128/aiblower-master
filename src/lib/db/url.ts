/**
 * Connection string from DATABASE_URL or DB_* variables (see .env.example).
 */
export function getDatabaseUrl(): string {
  const direct = process.env.DATABASE_URL?.trim();
  if (direct) {
    return direct;
  }

  const host = process.env.DB_HOST?.trim();
  const port = process.env.DB_PORT?.trim() || "5432";
  const name = process.env.DB_NAME?.trim();
  const user = process.env.DB_USER?.trim();
  const pass = process.env.DB_PASSWORD ?? "";

  if (!host || !name || !user) {
    throw new Error(
      "Database not configured: set DATABASE_URL or DB_HOST, DB_NAME, DB_USER (and DB_PASSWORD if needed).",
    );
  }

  const encUser = encodeURIComponent(user);
  const encPass = encodeURIComponent(pass);
  const ssl = process.env.DB_SSL === "true" || process.env.DB_SSL === "1";
  const sslMode = ssl ? "require" : process.env.DB_SSLMODE?.trim() || "disable";
  return `postgresql://${encUser}:${encPass}@${host}:${port}/${name}?sslmode=${sslMode}`;
}
