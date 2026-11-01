/**
 * Build for Cloudflare without leaking local settings.
 *
 * The OpenNext build copies every .env file (.env, .env.local, .env.production, …) into the Worker
 * bundle. Locally .env holds your database URL, SMTP password, etc., which must not be uploaded,
 * and would also override the Cloudflare settings. So this script sets those files aside during
 * the build and always puts them back. On Cloudflare, settings come from wrangler.jsonc "vars" and
 * `npx wrangler secret put NAME` instead.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, renameSync } from "node:fs";

const SUFFIX = ".cf-build-hidden";

// Put back files left aside by an interrupted earlier run.
for (const f of readdirSync(".")) {
  if (f.endsWith(SUFFIX)) {
    const original = f.slice(0, -SUFFIX.length);
    if (!existsSync(original)) renameSync(f, original);
  }
}

const envFiles = readdirSync(".").filter((f) => /^\.env(\..+)?$/.test(f) && f !== ".env.example");
const moved = [];
const restore = () => {
  for (const f of moved.splice(0)) if (existsSync(f + SUFFIX)) renameSync(f + SUFFIX, f);
};
process.on("SIGINT", () => { restore(); process.exit(130); });

let status = 1;
try {
  for (const f of envFiles) {
    renameSync(f, f + SUFFIX);
    moved.push(f);
  }
  if (moved.length) console.log(`Set aside for the Cloudflare build (restored afterwards): ${moved.join(", ")}`);
  status = spawnSync("npx", ["opennextjs-cloudflare", "build", ...process.argv.slice(2)], { stdio: "inherit", shell: true }).status ?? 1;
} finally {
  restore();
}
process.exit(status);
