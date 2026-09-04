-- Stage 3 (Varmen DB) — welfare.loan_requests
--
-- DRAFT. Not run automatically by anything. Only run via
-- `node --env-file=.env src/db-migrate.js`, and only after:
--   1. This exact SQL has been reviewed again, verbatim, by the user.
--   2. The user has given the explicit "run the migration" go-ahead.
--   3. A read-only check has confirmed the `welfare` schema still exists
--      (assumed per the user's 2026-09-03 confirmation, re-verified before
--      this runs — see src/db-migrate.js).
--   4. VARMEN_EXPECTED_DB / VARMEN_EXPECTED_USER are set in .env and the
--      identity check (src/db.js verifyIdentity) passes.
--
-- Assumes the `welfare` schema already exists — no CREATE SCHEMA here.
--
-- Column set = the original 19 columns approved in the 2026-09-03 rollout
-- plan (C:\Users\LED 269\.claude\plans\flickering-beaming-brooks.md), plus
-- 5 columns added 2026-09-04 (grill-me session, explicit approval) to match
-- fields the pipeline now actually produces that the original plan
-- predates: loan_status (6th HTML column, "Status" → "Loan Status"),
-- gap_filled_from_message_id / gap_filled_at (automatic same-sender
-- gap-fill merge), corrected_by / corrected_at (manual review corrections
-- file, src/pipeline.js applyManualCorrections). See docs/HANDOVER.md for
-- the full chronology of each.
--
-- source_id as PRIMARY KEY mirrors (and DB-enforces) the idempotency rule
-- already implemented in src/store.js. updated_at is set explicitly by
-- application code (src/pg-store.js, not yet built) on every upsert — no
-- DB trigger, per explicit decision (this codebase avoids DB-side logic;
-- everything stays visible in application code).

CREATE TABLE welfare.loan_requests (
  source_id                   text PRIMARY KEY,
  gmail_thread_id              text NOT NULL,
  received_at                  timestamptz NOT NULL,
  parser_version               text,
  parse_status                 text NOT NULL,
  review_notes                 text,
  requested_by                 text,
  amount                       text,
  reason                       text,
  loan_type                    text,

  -- Added 2026-09-04 — see header comment above.
  loan_status                  text,
  gap_filled_from_message_id   text,
  gap_filled_at                timestamptz,
  corrected_by                 text,
  corrected_at                 timestamptz,

  ack_status                   text,
  ack_source_message_id        text,
  ack_thread_id                text,
  ack_recipient                text,
  ack_draft_id                 text,
  ack_template_version         text,
  ack_prepared_at              timestamptz,

  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now()
);
