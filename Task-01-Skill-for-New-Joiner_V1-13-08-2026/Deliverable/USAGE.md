# new-joiner-guide — Usage Notes

## What it is

A Claude Skill that coaches a Mini-AIOS new joiner through the **Mini-AIOS New Joiner Complete Guide**. It identifies where the joiner is in the onboarding/task lifecycle, sequences the relevant guide steps, distinguishes advisory guidance from what Claude can actually do in the current environment, and escalates to the named human owner whenever the guide requires approval.

**File:** `.claude/skills/new-joiner-guide/SKILL.md`
**Source of truth it operationalizes:** `resource/Mini-AIOS_New_Joiner_Complete_Guide (1) (1).pdf` (not reproduced in full — see `TRACEABILITY.md` for the section-by-section mapping).

## Install

The skill already lives at project scope (`.claude/skills/new-joiner-guide/`), so it's automatically available to anyone who opens this repository in Claude Code — no extra setup step.

To make it available across *all* of a person's projects instead of just this repo, copy the same folder to `~/.claude/skills/new-joiner-guide/` (personal scope). No other files are needed — the skill is fully self-contained in the single `SKILL.md`.

## How to invoke it

- **Natural language (automatic):** just describe your situation — e.g. *"I'm new here, how do I start?"*, *"I received a task"*, *"I finished my work, is it done?"*, *"I can't access the LEDSone connector"*, *"continue from where I stopped"*. Claude will load the skill on its own when a message matches.
- **Direct invocation:** `/new-joiner-guide` optionally followed by a short description of your situation, e.g. `/new-joiner-guide I just got assigned a task and don't know where to start`.

## Behavior by environment

| Environment | What to expect |
|---|---|
| **Claude Chat** | Pure advisory coaching — explanations, checklists, copy-paste prompt templates. No claim of file/repo/database/connector access; every action is handed to you as a manual step. |
| **Claude Cowork** | Uses only whatever tools are actually configured in that workspace, and confirms a tool works before treating a step as done. Falls back to a manual next step if a capability is missing. |
| **Claude Code** | Can inspect the open repo/workspace and run safe (GREEN) actions directly when access is available. Will not perform AMBER/RED actions without approval, and never reports something as complete without evidence (a file path, command output, or a commit) it actually produced. |

## What it does

- Identifies the joiner's stage before giving instructions (new/setup, has-a-task, finished-work, blocked, resuming).
- Walks through the guide's actual setup, task, publishing, daily-log, handover, and governance rules in the guide's own sequence, prerequisites first.
- Hands over the guide's two reusable copy-paste prompt templates (Day-One folder skeleton kickoff, per-task GPT kickoff) verbatim.
- Classifies requested actions GREEN / AMBER / RED and stops on AMBER/RED to name the required human owner (Varmens, Sajeesan, Tamil Selvan, or MD, per what the guide assigns).
- Supports resuming: asks what's already done and continues from the correct next step.
- Ends every guidance flow with a completion checklist or an explicit escalation path.

## What it does NOT do

- Does not reproduce the New Joiner Guide as a static document — it gives condensed, actionable rules and always treats the guide itself as the source of truth.
- Does not act as ChatGPT's planning role — when the guide's loop calls for a GPT step, it hands the joiner the prompt to run in ChatGPT rather than planning the task itself.
- Does not claim to have accessed, changed, or verified anything without producing evidence in-session or getting the joiner's explicit confirmation.
- Does not request, store, display, or fabricate passwords, connection strings, or any other credential, under any circumstance.
- Does not approve restricted (AMBER/RED) actions, change company policy/roles/governance, or build new company apps/dashboards/connectors — those stay with the named human owners.
- Does not answer questions unrelated to new-joiner onboarding guidance.

## Known limitation

The skill's operational content is distilled and embedded directly in `SKILL.md` (by explicit design choice, so it works even with zero file access in Claude Chat) rather than read live from the PDF each time. If the underlying **Mini-AIOS New Joiner Complete Guide** is revised, `SKILL.md` must be manually updated to match — it will not pick up guide changes automatically. See `TRACEABILITY.md` for exactly which SKILL.md section maps to which guide section, to make re-sync after a guide update straightforward.

## Verifying it works

1. Say something matching the description (e.g. "I am new, how do I start?") in a fresh conversation and confirm Claude loads the skill.
2. Try `/new-joiner-guide` directly.
3. See `TEST-SCENARIOS.md` for the 6 required validation scenarios (normal, missing-information, and escalation cases) with pass/fail results already run against this skill.
