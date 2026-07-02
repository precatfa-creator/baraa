import assert from "node:assert/strict";
import test from "node:test";
import {
  isRouteAllowedForRole,
  navigationForRole,
  swipeDestination,
} from "../src/lib/navigation.ts";

test("sales reps only receive their four operational views", () => {
  assert.deepEqual(
    navigationForRole("sales_rep").map((item) => item.href),
    ["/dashboard", "/batches", "/unavailable", "/account"],
  );
});

test("sales rep route guard allows batch details but rejects hidden views", () => {
  assert.equal(isRouteAllowedForRole("/batches/abc", "sales_rep"), true);
  assert.equal(isRouteAllowedForRole("/unavailable", "sales_rep"), true);
  assert.equal(isRouteAllowedForRole("/requests", "sales_rep"), false);
  assert.equal(isRouteAllowedForRole("/stats", "sales_rep"), false);
});

test("mobile swipe follows visible navigation order and respects edges", () => {
  const hrefs = ["/dashboard", "/batches", "/unavailable", "/account"];
  assert.equal(swipeDestination("/dashboard", hrefs, -80), "/batches");
  assert.equal(swipeDestination("/batches/123", hrefs, -80), "/unavailable");
  assert.equal(swipeDestination("/unavailable", hrefs, 80), "/batches");
  assert.equal(swipeDestination("/dashboard", hrefs, 80), null);
  assert.equal(swipeDestination("/account", hrefs, -80), null);
});
