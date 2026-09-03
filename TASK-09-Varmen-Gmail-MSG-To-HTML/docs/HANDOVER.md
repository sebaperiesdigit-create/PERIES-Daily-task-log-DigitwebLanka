# Task 09 — Handover (last updated 2026-09-03, end of session)

**Read this file first when resuming this task.** It's the single source of
truth for "where did we leave off" — more current than `docs/README.md`
(architecture/mapping reference) and `CLAUDE.md` (stable repo guidance).
The full staged rollout plan (approved, revised) lives at
`C:\Users\LED 269\.claude\plans\flickering-beaming-brooks.md` — read that too
before doing anything Gmail/DB/deployment-related.

## TL;DR status

**46/46 tests passing. `PARSER_VERSION = "v7"`.** Stage 1 (Gmail read-only) and
Stage 2 (full Gmail integration) of the 5-stage plan are built and have been
run successfully against the real inbox twice today, in draft-only backfill
mode (zero acknowledgements created, as required). Stage 3 (Varmen DB),
Stage 4 (web page), Stage 5 (real sending) are **not started**.

The user explicitly said: **"leave [the remaining needs_review item] as-is
for manual review for now"** — do not build further auto-resolution for it
unless asked again.

## What actually works right now

- `npm run build` — demo pipeline, `fixtures/emails/*.json` (14 synthetic
  fixtures, all committed) → `output/loan-requests.html` + `output/acknowledgements/*.txt`
  (committed, synthetic data only)
- `node --env-file=.env src/run-live.js` — **real** Gmail read-only pipeline
  → `output/live/loan-requests.html` (gitignored, real data). **Only run this
  when the user explicitly asks** — it's a real, if read-only, mailbox call.
- Main table: 6 columns now — Date, Requested By, Amount, Reason, Loan Type,
  **Status** (added today; formally revises the original "exactly 5 columns"
  requirement, per explicit user approval)
- Needs-review section: shows sender/subject/received date, whatever fields
  DID extract, a direct "Open email" Gmail link, and the review note
- Acknowledgement drafts: local `.txt` files only, never sent, gated by
  `parseStatus === "ok"` and `backfillMode`

## Today's real-data findings and fixes (chronological — all in `PARSER_VERSION` history in `src/config.js`)

The parser was originally built against 5 calibration samples + synthetic
fixtures modeled on them. Running it against the real inbox surfaced several
gaps that only appeared at real scale. Each was found via evidence, fixed,
covered by a new test, and re-verified against the real inbox:

1. **v3 — replies were treated as new requests.** Gmail keeps `Re:` on every
   reply, so a single thread's back-and-forth inflated `needs_review` (15/18
   on the first real run). Fixed: `config.isQualifying` now excludes anything
   that looks like a reply entirely (Re:/Fwd: subject, or a quoted-history
   marker in the body) — see `src/gmail-reply-marker.js` `isReplyMessage`.
2. **v4 — hard line-wraps truncated the Reason field.** Real emails wrap at
   ~78 chars mid-sentence ("...due to an\r\nurgent personal matter."); the
   reason regex stopped at the line break. Fixed: `unwrapHardLineWraps` in
   `src/parser.js` joins wrapped lines back together before extraction, while
   preserving real paragraph breaks.
3. **v5 — name-cleanup.** One signature used markdown emphasis
   (`*M. Renuha*` → literal asterisks leaked into the stored name); this
   org's Gmail accounts are also labeled `firstname digitweblanka`/`digitweb`,
   which isn't a real name component. Fixed: `cleanExtractedName` in
   `src/parser.js`, config `nameOrganizationSuffixes`.
4. **v6 — two fixes from real emails the user opened via the new "Open email" link:**
   - Reason patterns were too narrow ("for personal reasons", "to support my
     current financial requirements" weren't recognized). Added `"to
     support"` trigger + a distinct `for ... reason(s)` pattern
     (`config.reasonReasonWordPattern`).
   - **Gap-filling merge** (narrowly scoped, explicitly approved): a
     same-sender, same-thread reply can now fill a genuinely **missing**
     field on a `needs_review` original — never overwrites an already-set
     value, never touches an already-`ok` record, never listens to anyone
     but the original requester. See `mergeGapFillingReplies` in
     `src/pipeline.js`.
5. **v7 — new 6th column, "Status".** Reads `Scheduled for <Month>` from
   staff replies (from `welfaredw@gmail.com` specifically — a different,
   deliberately looser trust model than the 4 business fields, since staff
   genuinely are the authority for approval/scheduling). Found and fixed a
   real bug here too: Gmail's real `From` header is `"Display Name <address>"`,
   not the bare address — the first version's exact-string match against the
   bare configured address never matched real staff replies. Fixed via
   `fromHeaderMatchesAddress` (substring match) in `src/pipeline.js`.

**Net result of today's fixes, verified on the real inbox (one thread's
identity omitted deliberately — see "Do not do" below):** went from 3 `ok` /
15 `needs_review` (first raw run, before any of today's fixes) to 4 `ok` / 1
`needs_review` (after all fixes) out of 18 real subject-matching messages, 13
of which are correctly-excluded ordinary replies. The one remaining
`needs_review` item is missing `loanType` only, and genuinely so — no one
(requester or staff) ever states a type anywhere in that thread. Left for
manual review per explicit instruction.

## Do NOT do, without the user explicitly asking again

- Do **not** print, log, or write real email content (names/amounts/reasons/
  subjects/addresses) into any committed file, including this one. Everything
  above is described in aggregate/structural terms on purpose.
- Do **not** run `node --env-file=.env src/run-live.js` without being asked
  each time — it's a real mailbox call, even though read-only.
- Do **not** widen the gap-filling merge to trust staff-stated business-field
  values (e.g. a staff-mentioned loan type) — explicitly deferred today ("leave
  it as-is for manual review for now").
- Do **not** add `gmail.send`, touch Varmen DB, add scheduling/cron, or change
  Google Cloud settings — none of this exists in the codebase, intentionally.
- Do **not** delete `.env` or print its contents. DB credentials are already
  in there (`VARMEN_DB_*`), unused by any code.

## Open items for tomorrow (in rough priority order)

1. **Decide the next stage to work on:**
   - Do a genuine **non-backfill** live run (both runs today were backfill
     runs since `data/live/store.json` didn't exist yet each time — the
     "normal" acknowledgement-drafting path for genuinely new mail has not
     yet been exercised against real data)
   - Or move to **Stage 3** (Varmen DB) — schema already agreed in the plan
     file (`welfare.loan_requests`), credentials sitting in `.env` unused
   - Or **Stage 4** is blocked until Varmen/IT confirm a server + that it's
     internal-only (hard gate, not something to resolve alone)
   - Or finish the **Google app verification submission** (Stage 1 loose end
     — chosen over Testing-mode, but the actual submission — privacy policy
     page, review — was never started; current test-user access still works
     fine in the meantime)
2. `GMAIL_FETCH_SINCE_DAYS` (default 30) has never been explicitly revisited
   as a final value — adjustable via `.env` if the user wants a different window.
3. The user may want to review the actual real output themselves again
   (`output/live/loan-requests.html`, `data/live/store.json`) before deciding
   what's next — neither has been touched since the Status-column work.

## Quick reference — commands

```bash
npm test                                    # 46 tests, should all pass
npm run build                               # demo pipeline (safe, no network)
node --env-file=.env src/run-live.js        # REAL live pull - ask first
node --env-file=.env src/gmail-auth.js      # re-auth if the refresh token ever fails
node --env-file=.env src/gmail-calibrate.js # one-time calibration (already done; rarely needed again)
```

## Key files

| File | Purpose |
|---|---|
| `src/config.js` | All business rules (qualifying rule, extraction patterns, status detection, ack template) - `PARSER_VERSION` history documents every real-world fix chronologically |
| `src/parser.js` | Pure extraction logic (`parseEmail`, `extractFields`, `extractStatusFromStaffReply`) |
| `src/pipeline.js` | Orchestration: parse → gap-fill merge → status detection → ack drafting → store → HTML |
| `src/gmail-*.js` | Gmail-specific: auth, calibration, live fetch, message mapping, reply detection |
| `src/html.js` | Standalone HTML renderer (6-column main table + review section) |
| `test/pipeline.test.js` | Main test suite (demo/fixture-based) |
| `test/gmail-live.test.js` | Gmail-message-mapping + live/demo output isolation tests |
| `fixtures/emails/001-014*.json` | Synthetic test fixtures - each one documents (in its filename/companion test) exactly which real-world bug or rule it proves |
| `docs/README.md` | Architecture/mapping reference (may lag slightly behind this file - trust this file for "current state") |
| `.env` / `.env.example` | Real secrets (gitignored) / template (committed) - Gmail OAuth + Varmen DB creds, DB creds unused so far |
