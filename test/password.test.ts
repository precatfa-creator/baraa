import { test } from "node:test";
import assert from "node:assert/strict";
import { validateNewPassword } from "../src/lib/password.ts";

test("new password must be at least 8 characters", () => {
  assert.match(validateNewPassword("short", "short") ?? "", /8/);
});

test("new password confirmation must match", () => {
  assert.match(validateNewPassword("password1", "password2") ?? "", /غير متطابقتين/);
});

test("valid matching password is accepted", () => {
  assert.equal(validateNewPassword("pass@123", "pass@123"), null);
});
