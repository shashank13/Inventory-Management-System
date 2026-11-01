// Cloudflare adapter config. Every page is per-user and rendered on request,
// so no incremental (ISR) cache is needed.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
