import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("CREATE TABLE IF NOT EXISTS _schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  const name = "0001_initial.sql"; const done = await client.query("SELECT 1 FROM _schema_migrations WHERE name = $1", [name]);
  if (done.rowCount) console.log(name + " already applied");
  else { const sqlText = await readFile(resolve("apps/server/migrations/0001_initial.sql"), "utf8"); await client.query("BEGIN"); try { await client.query(sqlText); await client.query("INSERT INTO _schema_migrations(name) VALUES ($1)", [name]); await client.query("COMMIT"); } catch (error) { await client.query("ROLLBACK"); throw error; } console.log("Applied " + name); }
} finally { await client.end(); }
