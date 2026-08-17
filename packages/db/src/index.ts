import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export * from "./schema";

// Lazy singleton: avoids throwing at module-eval time when DATABASE_URL isn't
// set yet (e.g. during `next build` before the Marketplace env vars exist).
// Do NOT wrap this in a JS Proxy — see vercel-storage skill notes on why that
// breaks libraries that introspect the client object.
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!_db) {
    const sql = neon(process.env.DATABASE_URL!);
    _db = drizzle(sql, { schema });
  }
  return _db;
}
