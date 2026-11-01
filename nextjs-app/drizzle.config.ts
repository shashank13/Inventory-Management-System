import { defineConfig } from "drizzle-kit";

// drizzle-kit doesn't read .env by itself; Node 20.12+ can.
try { process.loadEnvFile(".env"); } catch { /* no .env file: use the real environment */ }

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
});
