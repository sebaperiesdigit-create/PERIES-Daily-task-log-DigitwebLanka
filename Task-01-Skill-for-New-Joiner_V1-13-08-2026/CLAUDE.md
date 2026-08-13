# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

This is **Task-01**: build a single new Claude Skill that turns the company's Mini-AIOS New Joiner Guide into an interactive onboarding coach. There is no application code, build system, package manager, or test runner here — the deliverable is a `.claude/skills/[skill-name]/SKILL.md` (plus any supporting files it needs), authored according to the two required source documents below. Treat this as a skill-authoring task, not a software project.

## Required source documents (read before authoring or editing the skill)

- `resource/Mini-AIOS_New_Joiner_Complete_Guide (1) (1).pdf` — the **authoritative operational source**. The skill must guide joiners through this guide's actual instructions, not invent its own process. The guide covers: GPT-is-brain/Claude-Code-is-worker division of labor, one-time setup (GitHub, repo, connectors, folder skeleton), the standard folder structure and forbidden names, the two PostgreSQL databases (`postgres`/Varmen AIOS vs `varmen_db`/LEDSone) and their access rules, the per-task GPT→Claude Code loop, HTML dashboard publishing destinations (Varmen AIOS/Hub, PH Team Board, `varmen_db`), the daily `daily_task` work log, task handover, and the GREEN/AMBER/RED governance model plus the Evidence Rule, Existing-Asset-First, and Unknown-Developer-Test.
- `Task-Requirement/Task-01_Claude_New-Joiner_Skill_Requirements.docx` — the **build spec** for this task. It defines scope, the 10 functional requirements (FR-01–FR-10), per-environment required behavior for Claude Chat / Claude Cowork / Claude Code, the conversation-routing table (entry points like "I am new", "I received a task", "I finished my work", "I cannot access X", "continue from where I stopped"), safety/governance rules, and the acceptance criteria and validation scenarios the finished skill must satisfy.

Both files are binary (PDF / DOCX) — the Read tool cannot open the DOCX directly; extract its text first (e.g. unzip it and strip the `word/document.xml` markup) rather than skipping it.

## Non-negotiable constraints from the task spec

These come directly from the requirement doc and override any generic skill-building instinct:

- **Don't duplicate the guide.** The skill references and operationalizes the guide; it must not copy the full guide text into SKILL.md as a static document.
- **Never claim capability the current environment doesn't have.** Claude Chat has no file/repo/connector access, Claude Cowork has only its configured tools, Claude Code has repo/workspace access when granted. The skill must state manual-step guidance instead of pretending to act when access is unavailable.
- **Escalate, never guess.** When the guide marks something restricted, unclear, or owner-controlled (per GREEN/AMBER/RED), the skill must stop and point to the named human owner (Varmens for setup/access/publishing destination, Sajeesan for technical correctness, Tamil Selvan for queryability/evidence, MD for out-of-scope approval) rather than inventing a workaround.
- **No secrets, ever.** Never request, display, store, or fabricate passwords, connection strings, or credentials.
- **State-aware, not a one-shot summary.** The skill must identify the joiner's situation first (new/setup, has-a-task, finished-work, blocked, resuming) and route to the relevant guide section, supporting session continuation ("what have you already done?").
- **Every rule must trace back to the guide or an explicitly approved input** — no invented processes, contacts, or commands.
- **Out of scope:** changing company policy/governance/roles in the guide, building new company apps/dashboards/connectors/automations, or turning this into a general-purpose assistant beyond new-joiner guidance.

## Skill-authoring conventions used in this repo

Two reference skills are already installed under `.claude/skills/` and define the house style — read them before writing the new skill:

- **`skill-builder`** (`.claude/skills/skill-builder/SKILL.md`, `reference.md`) — the canonical guide for how skills in this repo are built and audited. Key points to follow when authoring the new-joiner skill:
  - Run its Discovery Interview (goal/name, trigger phrases, step-by-step process, inputs/outputs, guardrails) before writing files, unless the requirement doc already answers a round.
  - Frontmatter: only set fields actually needed (`name`, `description`, `argument-hint`, `disable-model-invocation`, `allowed-tools`, `context`/`agent`, `model` — see `reference.md` for the full field table and the invocation-control matrix).
  - `description` is written as "Use when someone asks to [action], [action], or [action]," with natural trigger keywords.
  - Keep SKILL.md under 500 lines; push detailed reference material (e.g. long guide excerpts, checklists) into supporting files in the same skill directory and link to them.
  - **Mandatory clickable-question convention** (`reference.md#interaction-convention-clickable-questions-mandatory`): any question with a finite set of good answers must use `AskUserQuestion` with a recommended option marked `(Recommended)` and a custom-answer fallback; genuinely open-ended free text (situation descriptions, task details) is asked directly, not turned into forced-choice menus.
  - After building, document the new skill's name, trigger phrases, and purpose back in this CLAUDE.md.
- **`grill-me`** (`.claude/skills/grill-me/SKILL.md`) — a stress-testing skill for plans/designs. Useful to run against the new skill's design *before* building it (it explicitly hands off to `skill-builder` rather than building anything itself).

## Verifying the finished skill

There is no build/lint/test command in this repo. Verification follows `skill-builder`'s testing steps instead:
1. Natural-language trigger check — phrase a request matching the `description` and confirm Claude loads the skill; try 2–3 phrasings.
2. Direct invocation via `/[skill-name]`.
3. Edge cases: missing information, restricted/unclear action, mid-task resumption — these map directly to the task spec's **Required Validation Scenarios** (docx §10), which the deliverable must document with pass/fail results.
4. If many skills are installed, run `/context` to confirm the new skill's description isn't dropped from the character budget.

The task's own **Deliverable Requirements** (docx §8) additionally require: brief install/usage notes, a source/requirement traceability note (mapping skill rules back to specific guide sections), and documented test scenarios per supported environment (Chat / Cowork / Code) — treat these as part of "done," not optional extras.

## Built skill: `new-joiner-guide`

The deliverable skill for this task. Lives at `.claude/skills/new-joiner-guide/SKILL.md` (single self-contained file, ~275 lines, no supporting files — an explicit deviation from the usual multi-file convention, recorded in `Deliverable/UNRESOLVED-AMBIGUITIES.md` item 2).

- **Invocation:** both auto (natural language) and manual (`/new-joiner-guide [situation]`).
- **Trigger phrases:** "I am new" / "how do I start", "I received a task", "I finished my work", "I can't access X" / "something is missing", "continue from where I stopped" — plus general onboarding/setup/task-workflow/publishing/daily-log questions.
- **Purpose:** coaches a Mini-AIOS new joiner through the New Joiner Guide — identifies their stage, sequences the relevant guide steps, separates advisory guidance from what Claude can actually do in the current environment (Chat/Cowork/Code), and escalates to the named guide owner (Varmens/Sajeesan/Tamil Selvan/MD) on restricted or unclear actions. Does not replace ChatGPT's planning role in the GPT→Claude Code loop.
- **Deliverable docs:** `Deliverable/USAGE.md` (install/usage), `Deliverable/TRACEABILITY.md` (rule-by-rule source mapping), `Deliverable/TEST-SCENARIOS.md` (6/6 required validation scenarios, pass/fail), `Deliverable/UNRESOLVED-AMBIGUITIES.md` (owner decisions still needed).
