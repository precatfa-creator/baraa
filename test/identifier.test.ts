import { test } from "node:test";
import assert from "node:assert/strict";
import { USERNAME_RE, ID_CODE_RE, isIdCode } from "../src/lib/identifier.ts";

test("username must be 3-30 [a-z0-9_] and contain a letter", () => {
  assert.ok(USERNAME_RE.test("ahmed01"));
  assert.ok(USERNAME_RE.test("a_b"));
  assert.ok(!USERNAME_RE.test("123456"), "all-digits is not a username");
  assert.ok(!USERNAME_RE.test("ab"), "too short");
  assert.ok(!USERNAME_RE.test("Ahmed"), "must be lowercased already");
  assert.ok(!USERNAME_RE.test("a".repeat(31)), "too long");
  assert.ok(!USERNAME_RE.test("has space"));
});

test("id_code is exactly 6 digits", () => {
  assert.ok(ID_CODE_RE.test("123456"));
  assert.ok(!ID_CODE_RE.test("12345"));
  assert.ok(!ID_CODE_RE.test("1234567"));
  assert.ok(!ID_CODE_RE.test("12a456"));
});

test("isIdCode routes 6-digit identifiers to the id_code lookup", () => {
  assert.equal(isIdCode("123456"), true);
  assert.equal(isIdCode("ahmed01"), false); // -> username path
});
