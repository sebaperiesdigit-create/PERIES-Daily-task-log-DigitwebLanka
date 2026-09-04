-- Stage 3 (Varmen DB) — welfare.loan_requests, v9 columns
--
-- DRAFT. Not run automatically by anything. Only run once reviewed
-- verbatim by the user and explicitly approved, same as
-- sql/001_create_welfare_loan_requests.sql was.
--
-- Adds the 4 columns introduced by PARSER_VERSION v9 (2026-09-04, see
-- src/config.js for the full rationale):
--   - loan_type_source: HOW the loan_type value was determined (subject /
--     body / reason_inference / staff_reply / default_no_signal) - lets a
--     reader tell "requester explicitly said this" apart from "the system
--     guessed because nothing else matched", since Loan Type can no longer
--     be blank/needs_review.
--   - discrepancy_note: a human-readable flag when a staff reply (or a
--     subject/body disagreement) suggested a DIFFERENT value than what was
--     already extracted - the disagreement is recorded here, never
--     silently applied.
--   - staff_confirmed_from_message_id / staff_confirmed_at: provenance for
--     a field filled/upgraded from a staff confirmation reply - kept
--     deliberately separate from gap_filled_from_message_id/gap_filled_at
--     (same-sender reply) and corrected_by/corrected_at (manual
--     corrections file), matching this codebase's existing rule of never
--     conflating different provenance types under one field.
--
-- All 4 are nullable text/timestamptz - existing rows are unaffected
-- (NULL for all 4 until the next mirror write touches them). No data loss,
-- no rewrite of existing rows beyond the new columns defaulting to NULL.

ALTER TABLE welfare.loan_requests
  ADD COLUMN loan_type_source text,
  ADD COLUMN discrepancy_note text,
  ADD COLUMN staff_confirmed_from_message_id text,
  ADD COLUMN staff_confirmed_at timestamptz;
