// Run SQL files against the database over the pooler. Docker-free test/seed harness.
// Connection comes from CONN, or SUPABASE_DB_URL in .env.local (so no secret in the command).
// Usage: node scripts/run-sql.mjs file1.sql [file2 ...]
import { readFileSync } from "node:fs";
import pg from "pg";

// Load .env.local so SUPABASE_DB_URL is available without an inline CONN.
try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local — rely on an already-exported CONN/SUPABASE_DB_URL
}

const conn = process.env.CONN || process.env.SUPABASE_DB_URL;
const files = process.argv.slice(2);
if (!conn) {
  console.error("Set CONN or SUPABASE_DB_URL (session-pooler connection string).");
  process.exit(2);
}

const client = new pg.Client({ connectionString: conn });
client.on("notice", (n) => console.log("NOTICE:", n.message));
await client.connect();
await client.query("set search_path = public, extensions");

let failed = false;
for (const file of files) {
  console.log(`\n=== ${file} ===`);
  try {
    const res = await client.query(readFileSync(file, "utf8"));
    for (const r of Array.isArray(res) ? res : [res]) {
      for (const row of r.rows ?? []) {
        const v = Object.values(row)[0];
        if (typeof v === "string") {
          console.log(v);
          if (v.startsWith("not ok")) failed = true; // pgTAP failing assertion
        }
      }
    }
  } catch (e) {
    console.error(`ERROR in ${file}:`, e.message);
    await client.end();
    process.exit(1);
  }
}
await client.end();
process.exit(failed ? 1 : 0);
