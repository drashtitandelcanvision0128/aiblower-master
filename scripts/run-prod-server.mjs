import { execFileSync, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migratePath = join(root, "scripts", "migrate.mjs");
const standalonePath = join(root, ".next", "standalone", "server.js");

execFileSync(process.execPath, [migratePath], { stdio: "inherit", cwd: root, env: process.env });

if (existsSync(standalonePath)) {
  console.log("[start] Detected standalone build → node .next/standalone/server.js");
  execFileSync(process.execPath, [standalonePath], { stdio: "inherit", cwd: root, env: process.env });
} else {
  const sep = process.platform === "win32" ? ";" : ":";
  const bin = join(root, "node_modules", ".bin");
  const pathEnv = process.env.PATH ?? "";
  const env = { ...process.env, PATH: `${bin}${sep}${pathEnv}` };
  execSync("next start", { stdio: "inherit", cwd: root, env, shell: true });
}
