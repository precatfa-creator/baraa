// Live integration test for the shortage workflow (RPCs + RLS), end to end.
// Needs the seed data and these env vars (the anon key is enough — RPCs run with
// each user's JWT):
//   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
// Run: npm run test:workflow   (after `set -a; . ./.env.local; set +a`)
// Self-cleaning: deletes the request it creates. Exits non-zero on any failure.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anon) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  process.exit(2);
}

const PHARMACY = "22222222-2222-2222-2222-222222222222";
const ITEM = "dddddddd-dddd-dddd-dddd-dddddddddd01";
const REP_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";

let failures = 0;
function check(label, ok, detail = "") {
  console.log(`${ok ? "ok" : "NOT OK"} - ${label}${detail ? ` (${detail})` : ""}`);
  if (!ok) failures++;
}
async function asUser(email) {
  const s = createClient(url, anon);
  const { error } = await s.auth.signInWithPassword({ email, password: "password123" });
  if (error) throw new Error(`${email}: ${error.message}`);
  return s;
}

const pharm = await asUser("pharmacist@baraa.test");
const rep = await asUser("rep@baraa.test");

const c = await pharm.rpc("create_shortage_request", {
  p_pharmacy_id: PHARMACY, p_item_id: ITEM, p_quantity: 5, p_priority: "high", p_notes: null,
});
const reqId = c.data;
check("pharmacist creates request", !c.error && Boolean(reqId), c.error?.code);

const a = await rep.from("shortage_requests").select("assigned_to, status").eq("id", reqId).single();
check("auto-assigned to the one serving rep, status missing", a.data?.assigned_to === REP_ID && a.data?.status === "missing");

const p = await pharm.rpc("transition_shortage_status", { p_request_id: reqId, p_expected_status: "missing", p_new_status: "in_purchase" });
check("pharmacist blocked from starting purchase", p.error?.code === "42501", p.error?.code);

const t1 = await rep.rpc("transition_shortage_status", { p_request_id: reqId, p_expected_status: "missing", p_new_status: "in_purchase" });
check("rep starts purchase", !t1.error, t1.error?.code);

const stale = await rep.rpc("transition_shortage_status", { p_request_id: reqId, p_expected_status: "missing", p_new_status: "fulfilled" });
check("stale compare-and-set rejected", stale.error?.code === "55000", stale.error?.code);

const t2 = await rep.rpc("transition_shortage_status", { p_request_id: reqId, p_expected_status: "in_purchase", p_new_status: "fulfilled" });
check("rep fulfils", !t2.error, t2.error?.code);

const h = await rep.from("shortage_status_history").select("new_status").eq("shortage_request_id", reqId).order("created_at");
const seq = (h.data ?? []).map((r) => r.new_status).join(",");
check("history records the sequence", seq === "missing,in_purchase,fulfilled", seq);

// cleanup: there is no delete RLS policy on requests, so use the service role if available.
if (svc) {
  const admin = createClient(url, svc, { auth: { persistSession: false } });
  await admin.from("shortage_status_history").delete().eq("shortage_request_id", reqId);
  await admin.from("shortage_requests").delete().eq("id", reqId);
  console.log("# cleaned up test request");
} else {
  console.log(`# no service key; leaving test request ${reqId} (cancel it manually)`);
}

console.log(`\n${failures === 0 ? "PASS" : "FAIL"} — ${8 - failures}/8 checks`);
process.exit(failures === 0 ? 0 : 1);
