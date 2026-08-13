# Unresolved Guide Ambiguities

Compiled while authoring `new-joiner-guide` against the Mini-AIOS New Joiner Complete Guide and the Task-01 requirements docx. These are genuine gaps or unclear points that affect the skill's behavior — not routine situations the guide already resolves by saying "ask Varmens" (those are handled as normal escalations inside the skill itself, not listed here). Per governance, the skill's behavior in all five cases below is: **stop / ask / escalate — never guess**, exactly as built.

## 1. No defined threshold for "first few tasks"

**What's unclear:** Guide §8.5 requires GPT-first for "your first few tasks" and allows direct Claude Code prompting "once you know the pattern," but never defines a number, a task count, or any objective signal for when a joiner has moved past this stage.

**Why it matters:** `new-joiner-guide` Flow B (New Task) has to decide whether to insist on the GPT round-trip or allow a shortcut. An undefined threshold means the skill can't determine this on its own.

**Owner to confirm:** Varmens (per Guide §1.3, workflow questions).

**Safe temporary behavior built into the skill:** default to treating a joiner as still in "first few tasks" mode unless they explicitly say they're experienced with the pattern — bias toward the safer, more supervised path rather than assuming graduation.

## 2. Claude Cowork is not mentioned anywhere in the Guide

**What's unclear:** The Guide only discusses Claude and Claude Code (VS Code extension, Desktop app, terminal). It never names "Claude Cowork" or describes what tools/connectors/access that surface has for a Mini-AIOS joiner. All of this skill's Claude Cowork capability rules come from the Task-01 docx §5, not the Guide.

**Why it matters:** The skill has to apply Cowork-specific behavior (confirm capability/permission before treating actions as done, per docx) without any Guide-level detail on what Cowork can actually reach in this company's setup.

**Owner to confirm:** Varmens — whether Cowork is actually provisioned for joiners, and with what connectors.

**Safe temporary behavior built into the skill:** in Cowork, always confirm actual tool/connector availability in-session before claiming any capability, rather than assuming parity with Claude Code.

## 3. No definition of "sensitive / internal-HR-only" content for publishing

**What's unclear:** Guide §9.4's pre-push checklist says to confirm "nothing sensitive / internal-HR-only is in output meant for a wider audience" but gives no definition or examples of what counts as sensitive in this company's context.

**Why it matters:** Flow H (Publishing) surfaces this checklist item to the joiner but the skill cannot itself judge borderline cases.

**Owner to confirm:** Varmens or Tamil Selvan (queryability/evidence reviewer).

**Safe temporary behavior built into the skill:** flag anything the joiner seems unsure about rather than deciding for them; when in doubt, treat content as sensitive and hold the push pending confirmation.

## 4. No stated mechanism for AMBER-tier approval

**What's unclear:** Guide §12.1 says AMBER items (e.g. draft SQL for later execution, workflow/config documentation changes) need "reviewer approval first," but never states how that approval is requested or recorded — no form, sheet, email convention, or sign-off format is named.

**Why it matters:** The skill can tell a joiner an action is AMBER, but can't tell them the actual mechanics of getting or recording that approval.

**Owner to confirm:** Varmens (process) and/or Sajeesan (technical reviewer, if the approval is specifically about SQL/technical review).

**Safe temporary behavior built into the skill:** tell the joiner the action needs reviewer approval and point them to the relevant named reviewer, without inventing a specific approval process/form that isn't documented.

## 5. No documented mechanism for installing a Skill into Claude Chat or Claude Cowork

**What's unclear:** Neither the Guide nor the Task-01 docx documents the actual UI/process for uploading or enabling a Skill package in Claude Chat or Claude Cowork (unlike Claude Code, where `.claude/skills/` is a well-defined convention this repo already uses).

**Why it matters:** `deliverables/usage-and-install-notes.md` needs to tell a joiner or admin how to actually install the `new-joiner-guide-standalone` / `new-joiner-guide-universal` packages in those surfaces.

**Owner to confirm:** Varmens / whoever administers the company's Claude Chat and Cowork environments.

**Safe temporary behavior built into the deliverable:** the install notes explicitly say to check the current in-product skill-upload flow at install time rather than describing a specific menu path that isn't documented anywhere in the approved sources — avoiding an invented, possibly-wrong instruction.
