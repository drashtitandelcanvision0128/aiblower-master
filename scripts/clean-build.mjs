import { rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const nextDir = join(root, ".next");

const attempts = 4;
const pauseMs = 400;

for (let i = 1; i <= attempts; i += 1) {
  try {
    await rm(nextDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 80 });
    console.log("Removed .next (stale production output). Run: npm run build");
    process.exit(0);
  } catch (e) {
    const err = /** @type {NodeJS.ErrnoException} */ (e);
    const retryable = err.code === "EBUSY" || err.code === "EPERM" || err.code === "ENOTEMPTY";
    if (retryable && i < attempts) {
      await new Promise((r) => setTimeout(r, pauseMs));
      continue;
    }
    console.error(
      "Could not remove .next. On Windows, stop `npm run dev` and any `node .../server.js` using this project, then run: npm run clean",
    );
    console.error(err);
    process.exit(1);
  }
}
