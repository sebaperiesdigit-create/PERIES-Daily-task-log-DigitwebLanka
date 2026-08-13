# Standard Folder Structure & File Conventions

Source: Mini-AIOS New Joiner Complete Guide §6, §6.1. Identical for every staff member — only the files inside change to match actual work.

## Standard folders

| Folder | What goes in it |
|---|---|
| `evidence/` | Proof that work happened — query outputs, logs, screenshots, exported results |
| `documentation/` | Explanations of what something is, why it exists, how to use it |
| `handover/` | Notes so someone else can pick up unfinished work without asking |
| `closure/` | End-of-task / end-of-day closure notes |
| `validation/` | Checklists and reports proving output is correct |
| `workflows/` | Documentation of any automation (scheduled regeneration, scripts, etc.) |
| `sql/` | SQL files — inspection queries, validation queries, any SQL written |
| `capability/` | Reusable methods discovered while working — patterns worth reusing later |
| `prompts/` | Saved copies of the GPT-generated Project Instructions and task-specific SKILL.md for each task |
| `data-maps/` | Source-to-target mapping, including the PostgreSQL database-structure file for each task |
| `query-packs/` | Grouped, reusable sets of queries for a recurring purpose |
| `duplicate-risk-reports/` | Findings from Existing-Asset-First checks before creating something new |

## Per-task subfolders

Every folder **except `capability/`** follows the pattern `[folder]/[task-name]/` — e.g. `evidence/july-inventory-check/`. `capability/` stays flat because capabilities are reused across tasks, not owned by one.

## Forbidden folder/file names

Never use: **test, final, new, temp, random, notes, old**.

Why it matters (explain briefly, don't just say "not allowed"): these names hide what something actually is. Six months from now, nobody — including the person who made it — can tell from the name whether `test/` is disposable or load-bearing, or whether `final/` really is final. That makes the work unqueryable and fails the Unknown-Developer Test (see escalation-and-governance.md) later.

## SKILL.md vs CLAUDE.md — two different files, don't confuse them

Every task ends up with both saved — they serve different readers:

| File | Written for | Purpose |
|---|---|---|
| SKILL.md (task-specific) | GPT | A cut-down version of governance rules (Existing-Asset-First, Evidence Rule, Duplicate-Truth Prevention, etc.), scoped to this specific task. Uploaded as a Source into the task's GPT Project so GPT stays disciplined while writing prompts. |
| CLAUDE.md | Claude Code | The file Claude Code automatically looks for when it opens a folder. A short briefing on what this task/project is, so Claude Code — and anyone who opens Claude Code in that folder later — has context without being told out loud. |

**Important distinction this coaching skill must keep clear to the joiner:** the task-specific `SKILL.md` above is a *per-task* file the joiner's GPT project generates, living inside their own task folders. It is not the same thing as this reusable `new-joiner-guide` coaching skill (which lives under `.claude/skills/` and is installed once, not per task). Don't let a joiner think generating a task's `SKILL.md` is the same activity as re-configuring this coaching skill.
