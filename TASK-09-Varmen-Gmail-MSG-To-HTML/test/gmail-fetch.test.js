import { test } from "node:test";
import assert from "node:assert/strict";

import { buildSearchQuery } from "../src/gmail-fetch.js";

// Pure query-building logic only - fetchQualifyingEmails itself calls the
// real Gmail API and is verified manually, same as src/db.js/db-migrate.js.

function withEnv(key, value, fn) {
  const original = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  try {
    return fn();
  } finally {
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  }
}

test("default (GMAIL_FETCH_SINCE_DAYS unset) uses a 30-day after: clause", () => {
  withEnv("GMAIL_FETCH_SINCE_DAYS", undefined, () => {
    const now = new Date("2026-09-04T00:00:00Z");
    const query = buildSearchQuery(now);
    assert.equal(query, "subject:loan subject:request after:2026/08/05");
  });
});

test("a numeric GMAIL_FETCH_SINCE_DAYS overrides the window", () => {
  withEnv("GMAIL_FETCH_SINCE_DAYS", "7", () => {
    const now = new Date("2026-09-04T00:00:00Z");
    const query = buildSearchQuery(now);
    assert.equal(query, "subject:loan subject:request after:2026/08/28");
  });
});

test("real bug fix 2026-09-04: GMAIL_FETCH_SINCE_DAYS=\"all\" removes the date bound entirely", () => {
  withEnv("GMAIL_FETCH_SINCE_DAYS", "all", () => {
    const query = buildSearchQuery(new Date("2026-09-04T00:00:00Z"));
    assert.equal(query, "subject:loan subject:request");
    assert.doesNotMatch(query, /after:/);
  });
});

test("an invalid (non-numeric, not \"all\") value falls back to the 30-day default rather than throwing", () => {
  withEnv("GMAIL_FETCH_SINCE_DAYS", "not-a-number", () => {
    const now = new Date("2026-09-04T00:00:00Z");
    const query = buildSearchQuery(now);
    assert.equal(query, "subject:loan subject:request after:2026/08/05");
  });
});
