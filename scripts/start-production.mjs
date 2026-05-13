import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const standalone = join(root, ".next", "standalone", "server.js");

if (!existsSync(standalone)) {
  console.error(
    [
      "Missing .next/standalone/server.js — run a production build first:",
      "  npm run build",
      "",
      "This app uses Next.js output: \"standalone\". Do not use \"next start\"; it is unsupported",
      "for this configuration and can load a stale .next cache from an older deploy.",
    ].join("\n"),
  );
  process.exit(1);
}

const child = spawn(process.execPath, [standalone], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
