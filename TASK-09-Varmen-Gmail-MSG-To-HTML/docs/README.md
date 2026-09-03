# Task 09 — Welfare Loan Requests → HTML Tracker (first delivery)

Converts synthetic/redacted, Gmail-shaped loan-request messages into a self-contained
staff-facing HTML table. **Not connected to a live Gmail account, real mailbox, or
the Varmen database.** Source data is local JSON fixtures only.

## 1. Architecture summary

```
fixtures/emails/*.json   (synthetic "Gmail message" fixtures)
        │
        ▼
  src/parser.js           parseEmail(email, config)
        │  - config.isQualifying(email) decides whether a message is a loan
        │    request at all; non-matching mail is skipped entirely (never
        │    stored, never guessed at).
        │  - config.fieldPatterns extracts the 5 business fields from the body.
        │  - any missing/ambiguous field → parseStatus "needs_review" instead
        │    of inventing a value.
        ▼
  src/store.js             Store (data/store.json)
        │  - JSON object keyed by sourceId (the Gmail message id).
        │  - upsert by sourceId ⇒ reruns of the same message never duplicate.
        │  - survives process restarts (plain file on disk).
        ▼
  src/acknowledgement.js    prepareAcknowledgementIfNeeded({record, config, ackDir, now})
        │  - draft-only, local-only: no Gmail connection, no send, ever.
        │  - only runs for parseStatus "ok" records; skipped entirely for
        │    needs_review/ineligible.
        │  - idempotent by sourceId: if record.ack_status is already
        │    "prepared" (from a prior run), returns the record unchanged -
        │    no second file, no altered fields.
        │  - writes output/acknowledgements/<sourceId>.txt and adds private
        │    ack_* tracking fields to the record.
        ▼
  src/html.js               renderHtml(records)
        │  - escapes every value (escapeHtml) before interpolating into HTML.
        │  - main table: only parseStatus "ok" records, only the 5 required
        │    columns, in order.
        │  - separate "Needs review" section: source id + note only, never a
        │    business field value that wasn't fully parsed.
        │  - acknowledgement drafts are NEVER rendered here (files/store only).
        ▼
  output/loan-requests.html   standalone HTML file, opens with no server
  output/acknowledgements/*.txt   draft-only acknowledgement text, never sent
```

`src/pipeline.js` wires these together (`runPipeline`) and `src/run.js` is the
CLI entry point (`npm run build`) that points it at the real fixtures/store/output
paths under this project.

Everything is plain Node.js (v20+) with **no third-party dependencies** — the
JSON store and HTML renderer are both hand-rolled because the volume/complexity
here doesn't justify a database engine or templating library yet.

## 2. Source → column mapping

| Business column | Extracted from                                   | Assumption / status |
|---|---|---|
| Date             | Gmail received timestamp (`email.receivedAt`)    | **CONFIRMED 2026-09-03** — NOT any date written in the body. Derived in `src/parser.js`, not extracted via `fieldPatterns`. Always present for a real Gmail message, so a missing/mis-written date line in the body can never send an otherwise-valid request to review. |
| Requested By     | `Name:` line in the email body                   | Verbatim text, escaped on render. |
| Amount           | `Amount:` line in the email body                 | Stored/displayed as written (e.g. `LKR 25,000`); no currency normalization performed. |
| Reason           | `Reason:` line in the email body                 | Verbatim text, escaped on render. |
| Loan Type        | `Loan Type:` line in the email body               | Free text; no closed list enforced yet. |

Qualifying rule (**confirmed 2026-09-03**, based on 5 real subject lines from the
actual `welfarescoilt` inbox — no Gmail label exists to use instead): the subject
line contains both "loan" and "request" (case-insensitive), in either order. See
`src/config.js` — this is the **one place** the rule lives. Chosen over a
stricter adjacent-phrase match ("loan request") because 3 of the 5 real samples
put "Request" before "Loan" (e.g. "Request for Education Loan"); an
adjacent-only match would have silently skipped those. Validated against:
"Personal Loan Request", "Request for Welfare Loan – LKR 200,000", "Loan
request", "Request for Personal Loan Assistance with Salary Deduction
Facility", "Request for Education Loan" — locked in by an automated test
(`test/pipeline.test.js`).

Gmail account — **CONFIRMED 2026-09-03**: `welfaredw@gmail.com`. This inbox is
**mixed** (also receives newsletters/general society mail), so the qualifying
rule above is the real, load-bearing filter — not a redundant safety net.

Internal-only record fields (never shown in the staff-facing table):
`sourceId` (stable id, e.g. Gmail message id), `threadId`, `fromAddress`, `subject`,
`receivedAt`, `parseStatus` (`ok` / `needs_review`), `reviewNotes`, `parserVersion`,
and the acknowledgement-tracking fields (`ack_status`, `ack_source_message_id`,
`ack_thread_id`, `ack_recipient`, `ack_draft_id`, `ack_template_version`,
`ack_prepared_at`) described below.

## 2a. Acknowledgement-reply workflow (draft-only, local-only)

For a request that reaches `parseStatus: "ok"` for the first time, the pipeline
also prepares (but never sends) one acknowledgement draft:

- **Trigger:** automatic, in the same `npm run build` run, the first time a
  record becomes `ok`.
- **Idempotency:** keyed by `sourceId` only. Once `ack_status` is `"prepared"`
  for a source id, reruns leave it — and its draft file — untouched.
- **Thread linkage:** each fixture carries an explicit `threadId` (defaults to
  its own message id for a fresh request); the draft records which thread it
  replies into.
- **Output:** `output/acknowledgements/<sourceId>.txt` (recipient, thread id,
  source message id, subject, rendered body) plus the private `ack_*` fields
  on the store record. **Never** added to the staff-facing HTML table.
- **Template & sender — CONFIRMED 2026-09-03** (`src/config.js` →
  `config.acknowledgement`, `templateVersion: "v2"`): sent from
  `welfaredw@gmail.com`, display name "Digitweb Lanka Welfare Society", with
  approved wording. Every draft file is still clearly labeled `*** DRAFT
  ACKNOWLEDGEMENT - NOT SENT ***` — approving the wording/sender does not turn
  sending on; that still requires live Gmail activation, separately approved.
- **Send trigger — CONFIRMED 2026-09-03:** once live sending is approved, the
  acknowledgement should go out automatically, immediately after a request is
  successfully extracted — not gated on a staff review step first. This
  delivery already implements that trigger timing for the *local draft*; only
  the actual send is missing.
- **Scope boundary:** a "corrected" or "cancelled" request is explicitly
  **not detected** in this delivery — there is no confirmed real-world signal
  for either yet. The only guarantees implemented are: an ack is never
  prepared for anything but a fully-extracted `ok` record, and never prepared
  twice for the same `sourceId`. See "Known limitations" below.
- **No Gmail action of any kind** — no send, no draft creation via the Gmail
  API, no thread mutation. This is a local text file only.

## 3. Setup / run

```bash
npm run build   # fixtures/emails/*.json → data/store.json + output/loan-requests.html + output/acknowledgements/*.txt
npm test        # runs the automated test suite (node's built-in test runner)
```

No install step is required (zero dependencies). Requires Node.js 20+.

Then open `output/loan-requests.html` directly in a browser (double-click, or
`file://` URL) — no server, network, login, or build step needed to view it.
Acknowledgement drafts (if any were prepared) are plain-text files under
`output/acknowledgements/` — open with any text editor.

## 4. Regenerating the HTML

Add or edit a fixture in `fixtures/emails/` (same shape as the existing files:
`id`, `threadId`, `from`, `to`, `subject`, `receivedAt`, `bodyText`), then run
`npm run build` again. Existing stored records are upserted by `id`, so
re-running with the same fixture file never creates a duplicate row — and never
creates a second acknowledgement draft for a record already acknowledged.

## 5. What was tested (see `test/pipeline.test.js`, `npm test`)

1. A qualifying fixture produces exactly one correct row in the main table.
2. An ineligible fixture (subject doesn't mention a loan request) produces no
   row and is not stored at all.
3. Re-running the same fixtures repeatedly never duplicates a record (idempotent
   upsert by source id).
4. A fixture missing a required field (`amount`) is stored as `needs_review`
   with a note naming the missing field, is excluded from the main table, and
   does not affect other records.
5. A fixture whose values contain `< > & " '` renders those characters as
   literal escaped text in the output HTML (verified both at the `escapeHtml`
   unit level and end-to-end in the generated page).
6. Reopening the store file in a fresh `Store` instance (simulating a process
   restart) still returns the previously saved valid record.
7. `output/loan-requests.html` is manually verified to be self-contained (no
   external `<script src>`/`<link>` — inline `<style>` only) and to open
   correctly from the filesystem without a server.
8. `.gitignore` excludes the local runtime store; no credentials, tokens, or
   real email content exist anywhere in the fixtures, source, or generated
   output (all sender/recipient addresses and names are synthetic
   `*.test`/"Test Requester …" placeholders).
9. A valid request produces exactly one correctly addressed, thread-linked
   acknowledgement draft (`output/acknowledgements/<sourceId>.txt`), with the
   right `To`/`Thread ID`/`In reply to` fields and private `ack_*` tracking
   set on the record.
10. Rerunning the same request never produces a second acknowledgement: the
    draft file, `ack_status`, and `ack_prepared_at` are all unchanged after a
    second `npm run build` (verified both at the pipeline level and in
    isolated tests).
11. Ineligible and `needs_review` requests never produce an acknowledgement —
    no `ack_status` field, no draft file, in either the automated tests or
    a manual `npm run build`.

## 6. Known limitations / blockers before live Gmail activation

Nothing below is guessed at in the code — each is an explicit configuration
point or an open question:

**Confirmed as of 2026-09-03** (no longer open, kept here for traceability):
Gmail account (`welfaredw@gmail.com`, mixed inbox); qualifying rule (subject
contains "loan"+"request", any order); acknowledgement sender/display
name/wording (`welfaredw@gmail.com`, "Digitweb Lanka Welfare Society",
approved template); acknowledgement send trigger (immediate after extraction,
not gated on staff review); review workflow for `needs_review` records (a
staff member manually opens the original Gmail message and fills in the
missing detail — no in-app correction tool exists, and none was requested);
date semantics (Gmail received date, implemented in `src/parser.js`);
historical import (needed — see below); rough hosting direction (a simple
internal, password-protected web page — see below).

**Still open:**

- **Real email body template.** The `Label: value` body format
  (`Name:`/`Amount:`/`Reason:`/`Loan Type:` lines) is still an assumption
  based on the fixtures only — not yet checked against a real email. You'll
  share a redacted real example when available; the extraction patterns in
  `src/config.js` will be updated to match without touching the parser
  itself.
- **Allowed loan types.** No closed list is enforced; any extracted text is
  accepted verbatim. Deliberately left open — you'll decide once you've seen
  more real examples.
- **Historical import — CONFIRMED needed, details pending.** When Gmail is
  activated, past loan-request emails already in the inbox must be imported
  as a **one-time backfill**, not just new mail going forward. Confirmed
  rules for that backfill: it must **never** trigger an acknowledgement
  reply; it uses the same Gmail-received-date semantics as live mail; each
  message's Gmail ID is preserved for duplicate protection (same mechanism
  already used for live mail); unclear/incomplete historical emails still go
  to `needs_review`, never guessed. Still open: the exact history start date,
  and — since the current acknowledgement trigger fires automatically for
  every new "ok" record — a "backfill mode" flag will need to be added to the
  pipeline before Gmail activation, so a bulk historical import doesn't
  accidentally draft (or later send) acknowledgements for old requests. Not
  implemented yet since it only matters once live Gmail access exists.
- **Destination & access control — direction confirmed, details pending.**
  The intended end state is a simple internal web page (password-protected)
  backed by the live database, not a shared static HTML file — but exact
  hosting location and how staff log in are not decided yet. This delivery
  remains a locally generated static file only.
- **Live update schedule.** No scheduler/trigger is wired up; `npm run build`
  is a manual, on-demand run.
- **Varmen database.** Not used, not contacted, not approved, and no
  connection code exists in this codebase. Host/port/db name were shared
  out-of-band ahead of approval and are deliberately **not reproduced in this
  committed file**; the user now also has real DB credentials, but per this
  task's security rules those must never be pasted into chat or committed —
  `.env.example` (committed, names only) documents the expected variable
  names (`VARMEN_DB_HOST`, `VARMEN_DB_PORT`, `VARMEN_DB_NAME`,
  `VARMEN_DB_USER`, `VARMEN_DB_PASSWORD`); a real `.env` is gitignored and
  nothing in this codebase reads it yet — this is scaffolding only, not a live
  connection. If/when integration is approved, the mandated
  `SELECT current_database(), current_user;` identity check must run and pass
  (expected: `current_database = varmen_db`, `current_user = varmen_user`)
  before any write is attempted.
- **Gmail API credentials.** No OAuth/API key handling exists anywhere in this
  codebase; none should be added until an authorised, least-privilege Gmail
  connection is explicitly approved.
- **"Corrected" / "cancelled" request detection.** No real-world signal for
  either is confirmed yet, so no detection logic exists. A message that is
  actually a correction or cancellation will currently be treated like any
  other new qualifying email (parsed independently under its own `sourceId`)
  unless/until a rule is confirmed and implemented.
