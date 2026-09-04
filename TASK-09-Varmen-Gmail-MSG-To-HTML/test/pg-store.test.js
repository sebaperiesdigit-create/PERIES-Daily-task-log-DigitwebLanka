import { test } from "node:test";
import assert from "node:assert/strict";

import { recordToRow, rowToRecord, buildUpsertStatement } from "../src/pg-store.js";

// Pure mapping/SQL-building logic only - no real Postgres connection.
// PgStore's actual query methods (upsertAll/load/list) need a live DB and
// are verified manually (see docs/HANDOVER.md Stage 3 section), same as
// src/db.js/src/db-migrate.js.

test("recordToRow maps every known field to its column, missing fields become null", () => {
  const record = {
    sourceId: "abc123",
    threadId: "thread-1",
    receivedAt: "2026-08-24T10:24:54+05:30",
    parserVersion: "v8",
    parseStatus: "ok",
    requestedBy: "Test Requester A",
    amount: "LKR 100,000",
    reason: "an urgent personal matter",
    loanType: "Personal",
    status: "Submitted",
    // reviewNotes, gap-fill fields, corrected fields, ack_* fields all omitted on purpose
  };
  const row = recordToRow(record);

  assert.equal(row.source_id, "abc123");
  assert.equal(row.gmail_thread_id, "thread-1");
  assert.equal(row.received_at, "2026-08-24T10:24:54+05:30");
  assert.equal(row.parse_status, "ok");
  assert.equal(row.requested_by, "Test Requester A");
  assert.equal(row.loan_type, "Personal");
  assert.equal(row.loan_status, "Submitted");
  // fields the JS record didn't set at all become null, never undefined
  assert.equal(row.review_notes, null);
  assert.equal(row.gap_filled_from_message_id, null);
  assert.equal(row.corrected_by, null);
  assert.equal(row.ack_status, null);
});

test("recordToRow never includes fromAddress/subject/date - dropped columns per the approved plan", () => {
  const record = {
    sourceId: "abc123",
    threadId: "thread-1",
    fromAddress: "Someone <someone@example-welfare.test>",
    subject: "Personal Loan Request",
    date: "2026-08-24",
    parseStatus: "ok",
  };
  const row = recordToRow(record);

  assert.equal(Object.prototype.hasOwnProperty.call(row, "from_address"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(row, "subject"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(row, "date"), false);
});

test("buildUpsertStatement produces an INSERT ... ON CONFLICT (source_id) DO UPDATE with matching value count", () => {
  const record = { sourceId: "abc123", threadId: "thread-1", receivedAt: "2026-08-24T10:24:54+05:30", parseStatus: "ok" };
  const { sql, values } = buildUpsertStatement(record);

  assert.match(sql, /INSERT INTO welfare\.loan_requests/);
  assert.match(sql, /ON CONFLICT \(source_id\) DO UPDATE SET/);
  assert.match(sql, /updated_at = now\(\)/);
  // one $-placeholder per value, and they must line up 1:1
  const placeholderCount = (sql.match(/\$\d+/g) ?? []).length;
  assert.equal(placeholderCount, values.length);
  assert.equal(values[0], "abc123"); // source_id is always the first column/value
});

test("rowToRecord maps DB columns back to JS field names and converts timestamps to ISO strings", () => {
  const row = {
    source_id: "abc123",
    gmail_thread_id: "thread-1",
    received_at: new Date("2026-08-24T04:54:54.000Z"), // pg returns timestamptz as a Date
    parse_status: "ok",
    loan_status: "Submitted",
    requested_by: null,
  };
  const record = rowToRecord(row);

  assert.equal(record.sourceId, "abc123");
  assert.equal(record.threadId, "thread-1");
  assert.equal(record.receivedAt, "2026-08-24T04:54:54.000Z");
  assert.equal(record.parseStatus, "ok");
  assert.equal(record.status, "Submitted");
  assert.equal(record.requestedBy, null);
});

test("rowToRecord and recordToRow round-trip a record's known fields without loss", () => {
  const original = {
    sourceId: "abc123",
    threadId: "thread-1",
    receivedAt: "2026-08-24T10:24:54.000Z",
    parseStatus: "ok",
    requestedBy: "Test Requester A",
    amount: "LKR 100,000",
    reason: "an urgent personal matter",
    loanType: "Personal",
    status: "Submitted",
  };
  const row = recordToRow(original);
  // Simulate what pg would hand back for a timestamptz column.
  row.received_at = new Date(original.receivedAt);
  const roundTripped = rowToRecord(row);

  for (const [field, value] of Object.entries(original)) {
    assert.equal(roundTripped[field], value, `field "${field}" did not round-trip`);
  }
});
