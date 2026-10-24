import "dotenv/config";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required. Configure PostgreSQL before starting the API.");
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10, idleTimeoutMillis: 30_000 });
export const db = drizzle(pool, { schema });
