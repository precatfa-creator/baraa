import { test } from "node:test";
import assert from "node:assert/strict";
import { availableTransitions, statusLabel, type Status } from "../src/lib/workflow.ts";

const toSet = (role: Parameters<typeof availableTransitions>[0], status: Status) =>
  availableTransitions(role, status)
    .map((t) => t.to)
    .sort();

test("pharmacist may only cancel a missing request", () => {
  assert.deepEqual(toSet("pharmacist", "missing"), ["cancelled"]);
  assert.deepEqual(toSet("pharmacist", "in_purchase"), []);
  assert.deepEqual(toSet("pharmacist", "fulfilled"), []);
});

test("sales_rep drives the purchase but cannot reopen", () => {
  assert.deepEqual(toSet("sales_rep", "missing"), ["cancelled", "in_purchase"]);
  assert.deepEqual(toSet("sales_rep", "in_purchase"), ["cancelled", "fulfilled"]);
  assert.deepEqual(toSet("sales_rep", "fulfilled"), []);
});

test("company_admin can reopen a fulfilled request, and reopen needs a note", () => {
  assert.deepEqual(toSet("company_admin", "fulfilled"), ["missing"]);
  const reopen = availableTransitions("company_admin", "fulfilled")[0];
  assert.equal(reopen.needsNote, true);
});

test("no transitions out of a cancelled request for anyone", () => {
  for (const role of ["pharmacist", "sales_rep", "company_admin", "super_admin"] as const) {
    assert.deepEqual(toSet(role, "cancelled"), []);
  }
});

test("every status has an Arabic label", () => {
  for (const s of ["missing", "in_purchase", "fulfilled", "cancelled"] as Status[]) {
    assert.ok(statusLabel[s] && statusLabel[s].length > 0);
  }
});
