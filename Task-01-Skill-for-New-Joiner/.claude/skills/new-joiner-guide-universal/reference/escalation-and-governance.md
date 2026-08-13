# Governance, Escalation & Troubleshooting

Source: Mini-AIOS New Joiner Complete Guide §1.3, §12, §13, §14. These rules don't change task to task, even while the specific tools and steps around them do — apply them regardless of which stage the joiner is in.

## Who to ask

| Role | Person | Ask them about |
|---|---|---|
| Team Leader / Trainer | **Varmens** | Setup help, database credentials, where to publish, anything unclear in the guide |
| Technical Reviewer | **Sajeesan** | Technical correctness of what Claude Code built |
| Queryability Reviewer | **Tamil Selvan** | Whether evidence/documentation is clear enough for someone else to reuse |
| Managing Director | **MD** | Final approval on anything outside the joiner's assigned scope |

Teams ID (Varmens DigitWeb): **varmensk.digitweb@gmail.com** — new joiners, contact Varmens directly. Never substitute a different or invented contact for these.

## GREEN / AMBER / RED

| Level | Meaning | Example |
|---|---|---|
| GREEN | Safe to do without extra approval | Documentation, evidence packs, read-only inspection, safe Claude Code prompts |
| AMBER | Needs reviewer approval first | Draft SQL later run by a developer, workflow documentation updates, config documentation |
| RED | Not allowed without written approval | Production data changes, schema drops, business-rule changes, live automation execution |

If uncertain which level applies to something, **do not downgrade it silently** — ask or escalate to Varmens.

## Evidence Rule

**No evidence = no completed work.** "It works," "I checked it manually," and "I'll upload it later" are not evidence. A Git path, a saved query result, or a saved file is.

## Existing Asset First

Before creating anything new — including a database object — check what already exists in folders, GitHub, and the relevant database. **Reuse → extend → merge → create new**, in that order.

## Never share credentials with AI

Never type or paste passwords, connection strings, or any other credentials into Claude or GPT, in any form. Use the configured connectors instead.

## Troubleshooting

| Problem | Likely cause / fix |
|---|---|
| Claude Code seems to be deciding what to build on its own | Stop. Go back to GPT for the next prompt — Claude Code should only execute, never plan (unless past the first-few-tasks stage, and even then GPT-first is recommended) |
| Can't connect to a database from Claude Code | Check `postgres` / `LEDSone MCP` / `LEDSone MCP DOC` connectors are enabled (setup.md §5.4) |
| Not sure where to publish a finished dashboard | Ask Varmens — don't assume; the destination is decided per task |
| Push script fails on PowerShell | Use Git Bash instead, or ask Varmens — `$env:` syntax isn't the tested path |
| Re-pushing created a duplicate instead of updating | A different slug/identifier was used than last time — reuse the exact same one to update in place |
| `daily_task` INSERT fails: duplicate key | Run the last-`activity_id` SELECT first, then pick the next unused ID |
| Not sure if something already exists before building it | That's an Existing-Asset-First discovery prompt — ask GPT to generate one before creating anything, including a database check |
| Taking over a task and Claude Code can't explain it | The previous owner's handover was incomplete — flag it to Varmens rather than guessing |

## Quick reference card

```
SETUP (once) : GitHub (office Gmail) -> repo -> tool -> connectors -> folder skeleton
DATABASES    : postgres (Varmen AIOS/Hub, backup) | LEDSone (varmen_db, active)
WRITE ACCESS : varmen_db is the default -- ask Varmens for credentials
EVERY TASK   : Google Sheet requirement -> GPT Project (instructions +
               requirement + DB-structure file) -> discover DB -> folder
               prompt -> build -> CLAUDE.md/README/handover/evidence/prompts
               -> generate HTML -> push to assigned URL -> push to GitHub
FIRST TASKS  : GPT-first is MANDATORY. Later: optional, still recommended.
DAILY LOG    : INSERT INTO daily_task.tbl_<project>_<you> (8 fields min)
TAKING OVER  : Clone folder -> open Claude Code -> ask it to explain
NEVER        : share passwords with Claude/GPT, UPDATE old log rows,
               use test/final/new/temp/old as a folder or file name
CONTACT      : Varmens -- varmensk.digitweb@gmail.com
```
