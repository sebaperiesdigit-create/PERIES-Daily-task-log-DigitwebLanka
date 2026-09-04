# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ START HERE: read `docs/HANDOVER.md` before doing anything else

That file is the current, actively-maintained snapshot of exactly where this
task stands — what's built, what was fixed today and why, what's explicitly
deferred, and what's open for the next session. It is updated at the end of
every work session and is more current than the summary below or
`docs/README.md`. **Read it first.** Also read the approved staged rollout
plan at `C:\Users\LED 269\.claude\plans\flickering-beaming-brooks.md` before
touching anything Gmail/DB/deployment-related.

## Project status (brief - see `docs/HANDOVER.md` for the real, current detail)

This has grown well past the original "HTML table from fixtures" delivery. As of
2026-09-03: Stage 1 (Gmail read-only OAuth) and Stage 2 (full Gmail read-only
integration, including a gap-filling merge for same-sender corrections and a
6th "Status" column read from staff replies) are built, tested (46/46), and
have been run successfully against the real inbox in draft-only backfill
mode. Stage 3 (Varmen DB), Stage 4 (staff-facing web page), and Stage 5
(actually sending) are not started. See `docs/HANDOVER.md` for the full,
current picture — do not rely on this paragraph alone, it will go stale.

**Never do without explicit, fresh approval each time:** run
`node --env-file=.env src/run-live.js` (a real, if read-only, Gmail call) —
touch Varmen DB in any way — add a `gmail.send`/write scope or any actual
sending code — add scheduling/cron — change Google Cloud settings — print,
log, or commit real email content or credentials (`.env` has real Gmail OAuth
+ Varmen DB values; never read it back to the user or into a committed file).

## Task requirement (`Requirement/Task_09_requirement.txt`)

The requirement is written in Tanglish (mixed Tamil/English). Summary:

- Incoming Gmail messages to a welfare-society (`welfarescoilt`) mailbox contain **loan requests**.
- Each such email needs to be parsed and rendered into an **HTML table** with these columns:
  - Date
  - Requester name (who asked)
  - Amount requested
  - Reason
  - Loan type
- Every incoming loan-request mail should append/update a row in that HTML table (i.e. this is meant to run
  per new message, not as a one-off export).
- A database is anticipated as a later step — DB details are to be requested from "Varmen" once the
  HTML-table stage is working (hence the task folder name `Varmen-Gmail-MSG-To-HTML`).
- Deliverable for "today" (per the note) is scoped to just the **Gmail message → HTML table** conversion,
  not the DB integration.

When picking up this task, treat the above as the starting spec and confirm ambiguous points with the user
(e.g. which Gmail account/label to read from, how "today's" mails are identified, whether this runs as a
scheduled script, an Apps Script trigger, or a Claude Code skill invoked on demand) before implementing.

## Directory structure

- `Requirement/Task_09_requirement.txt` — the original task ask, verbatim, in Tanglish.
- `.claude/skills/` — active project skill definitions, copied in from other tasks in this workspace
  (`first-task-mapper`, `grill-me`). Originally sat in a folder named `claude` (missing the leading dot), which
  meant Claude Code didn't auto-load them; renamed to `.claude/skills/` so they're now live for this project.
  - `first-task-mapper` — converts a vague request into a labeled execution map (Confirmed/Assumption/Unknown
    fields) before any work starts; useful for turning this task's Tanglish note into a concrete plan.
  - `grill-me` — stress-tests a plan/design one question at a time before committing to it.

## Hub push

There is a `hub-push/` folder in this project root (copied from
Peries-Skills-Master's `output/skill-documentation/push_to_hub.js`) for
publishing a finished output HTML file to the Varmen AIOS hub — a
Postgres-backed table (`varman_aios.hub_pages`, `member_name='peries'`) with
a Vercel-facing viewer. It contains `push_to_hub.js`, its own
`package.json`/`package-lock.json`/`node_modules` (with `pg` installed), and
a `.env` holding `HUB_DATABASE_URL`.

Usage (run from inside `hub-push/`):

```
node --env-file=.env push_to_hub.js "<full-path-to-html-file>" "<page-slug>" "<page-title>"
```

Already pushed: `output/live/loan-requests.html` → slug
`Digit-Web-loan-requests`, title "Digit Web Loan Requests" (hub_pages id
425), live at `varman-aios-hub-varmens.vercel.app/view/hub_pages/Digit-Web-loan-requests`.

Rules: use a new slug for a new page, reuse a slug only to update that same
page; never hardcode or print the DB password outside `hub-push/.env`; if
this project ever becomes a git repo, add `hub-push/.env` to `.gitignore`
before the first commit.

## Repository context

This folder is one of several sibling `Task-NN-*` project directories inside the parent
`PERIES-DigitWebLanka` git repository (the actual git root is one level up, at
`C:\Users\LED 269\Desktop\PERIES-DigitWebLanka`). There is no repo-wide build system — each `Task-NN-*`
folder is an independent piece of work with its own tooling, added as that task is implemented.
