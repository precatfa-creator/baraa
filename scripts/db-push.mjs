// Apply pending migrations WITH tracking (writes supabase_migrations.schema_migrations),
// targeting the DB directly over the IPv4 session pooler. No `supabase link` or access
// token needed. Connection from SUPABASE_DB_URL in .env.local.
// Usage: node scripts/db-push.mjs [extra supabase flags]
import { spawnSync } from "node:child_process";

try {
  process.loadEnvFile(".env.local");
} catch {
  // rely on an exported SUPABASE_DB_URL/CONN
}

const url = process.env.SUPABASE_DB_URL || process.env.CONN;
if (!url) {
  console.error("Set SUPABASE_DB_URL in .env.local (session-pooler connection string).");
  process.exit(2);
}

const args = ["db", "push", "--db-url", url, ...process.argv.slice(2)];
const r = spawnSync("./node_modules/.bin/supabase", args, { stdio: "inherit" });
process.exit(r.status ?? 1);
