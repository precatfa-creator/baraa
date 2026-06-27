// Run SQL files against the database over the pooler. Docker-free test/seed harness.
// Usage: CONN="postgresql://...pooler...:5432/postgres" node scripts/run-sql.mjs file1.sql [file2 ...]
// Prints text result rows (pgTAP TAP lines, etc.) and NOTICEs; exits non-zero on error or a failing test.
import { readFileSync } from "node:fs";
import pg from "pg";

const files = process.argv.slice(2);
if (!process.env.CONN) {
  console.error("Set CONN to the Supabase session-pooler connection string.");
  process.exit(2);
}

const client = new pg.Client({ connectionString: process.env.CONN });
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
