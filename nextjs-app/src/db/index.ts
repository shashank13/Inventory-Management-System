/**
 * Database connection.
 *  - Locally / on Node.js: one shared connection pool.
 *  - On Cloudflare Workers: a connection can't be reused across requests, so each request gets its
 *    own small client (cheap when it goes through Hyperdrive). Call getDb() once per request and
 *    pass the result down.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type DB = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
/** Anything that can run queries: the database or an open transaction. */
export type Exec = DB | Tx;

const onWorkers = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

function connectionString(): string {
  if (onWorkers) {
    try {
      const env = getCloudflareContext().env as { HYPERDRIVE?: { connectionString?: string } };
      if (env.HYPERDRIVE?.connectionString) return env.HYPERDRIVE.connectionString;
    } catch {
      /* no Hyperdrive binding: fall back to DATABASE_URL */
    }
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
  return url;
}

function connect(max: number): DB {
  const client = postgres(connectionString(), {
    max,
    idle_timeout: 20,
    connect_timeout: 10,
    fetch_types: false, // only built-in types are used; skips a round trip on connect
    onnotice: () => {},
  });
  return drizzle(client, { schema });
}

const globalForDb = globalThis as unknown as { __nfpcDb?: DB };

export function getDb(): DB {
  if (onWorkers) return connect(5);
  // Reuse one pool (also across hot reloads in `next dev`).
  return (globalForDb.__nfpcDb ??= connect(10));
}

export { schema };
