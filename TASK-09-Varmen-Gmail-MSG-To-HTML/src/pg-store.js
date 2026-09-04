import { withVerifiedClient } from "./db.js";

/**
 * Stage 3 (Varmen DB) — mirrors loan-request records into
 * welfare.loan_requests. Per the explicit "parallel JSON+DB" decision
 * (grill-me session, 2026-09-04 — see docs/HANDOVER.md), this is a
 * SECONDARY, best-effort store: data/live/store.json (src/store.js) remains
 * the pipeline's sole source of truth for HTML rendering, gap-fill lookups,
 * and the review workflow. This class exists so `src/pipeline.js` can mirror
 * writes here in parallel, for verification during the transition period —
 * it never replaces the JSON store, and nothing reads from this class to
 * drive pipeline logic.
 *
 * Column set is intentionally narrower than the JS record shape:
 * `fromAddress`/`subject`/`date` aren't stored here (dropped per the
 * approved 2026-09-03 plan as "duplicated/unneeded"; `threadId` maps to
 * `gmail_thread_id` instead, and `received_at` is the sole date source). A
 * record read back via `load()`/`list()` below is NOT sufficient on its own
 * to render the review UI — that's expected, this store isn't used for that.
 *
 * Same interface shape as src/store.js (`load`/`upsert`/`upsertAll`/`list`),
 * per the original Stage 3 plan, but every method here is async (a real
 * network call, unlike the synchronous JSON file store) — callers must await.
 */

// JS record field -> welfare.loan_requests column, in insert order.
const FIELD_TO_COLUMN = {
  sourceId: "source_id",
  threadId: "gmail_thread_id",
  receivedAt: "received_at",
  parserVersion: "parser_version",
  parseStatus: "parse_status",
  reviewNotes: "review_notes",
  requestedBy: "requested_by",
  amount: "amount",
  reason: "reason",
  loanType: "loan_type",
  status: "loan_status",
  gapFilledFromMessageId: "gap_filled_from_message_id",
  gapFilledAt: "gap_filled_at",
  correctedBy: "corrected_by",
  correctedAt: "corrected_at",
  // v9 (2026-09-04) - see sql/002_add_v9_columns.sql (drafted, NOT run yet
  // against the real table - see docs/HANDOVER.md Stage 3 section).
  loanTypeSource: "loan_type_source",
  discrepancyNote: "discrepancy_note",
  staffConfirmedFromMessageId: "staff_confirmed_from_message_id",
  staffConfirmedAt: "staff_confirmed_at",
  ack_status: "ack_status",
  ack_source_message_id: "ack_source_message_id",
  ack_thread_id: "ack_thread_id",
  ack_recipient: "ack_recipient",
  ack_draft_id: "ack_draft_id",
  ack_template_version: "ack_template_version",
  ack_prepared_at: "ack_prepared_at",
};

const COLUMN_TO_FIELD = Object.fromEntries(
  Object.entries(FIELD_TO_COLUMN).map(([field, column]) => [column, field])
);

const COLUMNS = Object.values(FIELD_TO_COLUMN);

const TIMESTAMP_COLUMNS = new Set([
  "received_at",
  "gap_filled_at",
  "corrected_at",
  "ack_prepared_at",
  "staff_confirmed_at",
  "created_at",
  "updated_at",
]);

/** Maps one JS record to a { column: value } row, missing fields as null. Exported for testing. */
export function recordToRow(record) {
  const row = {};
  for (const [field, column] of Object.entries(FIELD_TO_COLUMN)) {
    row[column] = record[field] ?? null;
  }
  return row;
}

/** Maps one DB row (snake_case columns, pg-parsed types) back to the JS record shape. Exported for testing. */
export function rowToRecord(row) {
  const record = {};
  for (const [column, value] of Object.entries(row)) {
    const field = COLUMN_TO_FIELD[column];
    if (!field) continue; // ignore any column this store doesn't know about (e.g. future additions)
    record[field] = TIMESTAMP_COLUMNS.has(column) && value instanceof Date ? value.toISOString() : value;
  }
  return record;
}

/** Builds the parameterized upsert SQL + values for one record. Exported for testing. */
export function buildUpsertStatement(record) {
  const row = recordToRow(record);
  const values = COLUMNS.map((column) => row[column]);
  const placeholders = COLUMNS.map((_, i) => `$${i + 1}`);
  const updates = COLUMNS.filter((c) => c !== "source_id")
    .map((c) => `${c} = EXCLUDED.${c}`)
    .concat("updated_at = now()")
    .join(", ");

  const sql = `INSERT INTO welfare.loan_requests (${COLUMNS.join(", ")})
VALUES (${placeholders.join(", ")})
ON CONFLICT (source_id) DO UPDATE SET ${updates};`;

  return { sql, values };
}

export class PgStore {
  /**
   * Mirrors every record in `recordList` into welfare.loan_requests, inside
   * one transaction + one identity check. Throws on any failure (a
   * permissions error, a missing table, a connection problem) — it is the
   * CALLER's responsibility to catch this so a DB problem never breaks the
   * JSON-store-driven pipeline (see src/pipeline.js `mirrorToPgIfEnabled`).
   */
  async upsertAll(recordList) {
    if (recordList.length === 0) return;
    await withVerifiedClient(async (client) => {
      await client.query("BEGIN");
      try {
        for (const record of recordList) {
          const { sql, values } = buildUpsertStatement(record);
          await client.query(sql, values);
        }
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    });
  }

  /** Thin wrapper over upsertAll, for interface parity with src/store.js. */
  async upsert(record) {
    await this.upsertAll([record]);
  }

  /**
   * Reads every row back, keyed by sourceId — for manual verification only
   * (e.g. via a debug script), never called by src/pipeline.js. See the
   * class-level doc comment: this store is not the pipeline's read path.
   */
  async load() {
    return withVerifiedClient(async (client) => {
      const result = await client.query(`SELECT ${COLUMNS.join(", ")} FROM welfare.loan_requests;`);
      const records = {};
      for (const row of result.rows) {
        const record = rowToRecord(row);
        records[record.sourceId] = record;
      }
      return records;
    });
  }

  async list() {
    return Object.values(await this.load());
  }
}
