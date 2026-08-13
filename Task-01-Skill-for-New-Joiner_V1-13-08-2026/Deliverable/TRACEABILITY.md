# new-joiner-guide — Source & Requirement Traceability

Purpose: let a reviewer trace every operational rule in `SKILL.md` back to the guide section or requirement-doc item it came from, per docx §8 (Deliverable Requirements → Source use) and §9 (Acceptance Criteria → "a reviewer can trace every operational rule back to the guide or an explicitly approved project input").

Guide = `resource/Mini-AIOS_New_Joiner_Complete_Guide (1) (1).pdf`. Requirement doc = `Task-Requirement/Task-01_Claude_New-Joiner_Skill_Requirements.docx`.

## SKILL.md section → Source mapping

| SKILL.md section | Guide section(s) | Requirement doc item(s) |
|---|---|---|
| What This Skill Does / GPT Is Still the Brain | §1.1 (GPT=Brain, Claude Code=Worker) | Task Statement (§1), Purpose |
| Capability Boundaries by Environment | — (derived; guide doesn't cover Claude-product boundaries) | §5 Supported Claude Environments; FR-06; Acceptance Criteria (capability boundaries) |
| People & Escalation Owners | §1.3 Who To Ask | §7 Safety/Governance ("named human owner"); FR-07 |
| Step 1 — Identify the situation | §6.2 (guide has no direct equivalent; routing logic is requirement-doc original) | §6 Conversation & Guidance Design (routing table); FR-01 |
| Step 2 — Sequence, prerequisites first | Whole-guide structure (guide itself is sequential, §5→§13) | FR-02 |
| Step 3 — Concise, actionable responses | — | FR-03 |
| Step 4 — Ask, don't guess (+ clickable questions) | §13 Troubleshooting ("that's a discovery prompt... ask GPT") | FR-04, FR-09; house convention: `skill-builder/reference.md` mandatory clickable-question rule |
| Step 5 — Advisory vs. action | §7.3, §12.5 (credentials/connectors config'd outside chat — implies action/advisory split) | §5 Supported Environments; FR-06 |
| Step 6 — Stop & escalate | §12.1 GREEN/AMBER/RED | §7 Safety/Governance; FR-07; Acceptance Criteria (no bypass) |
| Step 7 — Support continuation | §11 Taking Over Someone Else's Task (adapted: same "ask it to explain" pattern applied to self-continuation) | §6 routing table ("Continue from where I stopped"); FR-08 |
| Step 8 — Close with a check or escalation | §8.6 Task Closure (question list) | FR-10 |
| Reference A — One-Time Setup | §5 (5.1–5.6, incl. verbatim GPT kickoff prompt) | §5 Supported Environments (setup path); Validation Scenario 1 |
| Reference B — Folder Structure | §6, §6.1 | §3 Scope (in-scope: contextual checklists) |
| Reference C — Databases | §7 (7.1–7.3) | §7 Safety/Governance (no secrets rule) |
| Reference D — Task Workflow | §8 (8.1–8.6, incl. verbatim GPT kickoff prompt) | Validation Scenario 2; FR-05 (reusable prompts) |
| Reference E — Publishing | §9 (9.1–9.4) | §6 routing table (implicit — publishing is part of "finished my work") |
| Reference F — Daily Work Log | §10 (10.1–10.5) | §6 routing table ("I finished my work" → logging check) |
| Reference G — Handover/Takeover | §11 | §6 routing table ("Continue from where I stopped") |
| Reference H — Governance Essentials | §12 (12.1–12.5) | §7 Safety, Governance, and Content Rules |
| Reference I — Troubleshooting | §13 | FR-09 (troubleshooting from the guide, no guessing) |
| Business Context | §3 (3.1–3.3) | — (background only, not an operational rule) |
| Safety Guardrails | §7.3, §12.5 (credentials); §12.1 (RED = no bypass) | §7 Safety, Governance, and Content Rules (all bullets); Acceptance Criteria (no secrets, no bypass) |
| Out of Scope | — | §3 Scope table (Out of scope column); §12 Explicit Non-Requirements |

## Requirement doc FR → SKILL.md mapping (reverse direction)

| FR | Requirement | Where enforced in SKILL.md |
|---|---|---|
| FR-01 | Identify need/stage before detailed instructions | Step 1 |
| FR-02 | Logical sequence, prerequisites before dependent steps | Step 2, every Reference section's ordering |
| FR-03 | Concise actionable responses (what/why/evidence/next) | Step 3 |
| FR-04 | Focused follow-up questions when unclear | Step 4 |
| FR-05 | Reusable prompts/checklists only when guide-supported and environment-appropriate | Reference A & D verbatim GPT prompts; Capability Boundaries table gates environment-appropriateness |
| FR-06 | Distinguish advisory vs. actual action | Step 5, Capability Boundaries table |
| FR-07 | Stop/escalate on restricted/unclear/owner-controlled | Step 6, Reference H (GREEN/AMBER/RED) |
| FR-08 | Support continuation | Step 7 |
| FR-09 | Troubleshoot from the guide, never guess | Step 4, Reference I |
| FR-10 | End with completion check or escalation path | Step 8 |

## Content deliberately not carried into SKILL.md

Per the requirement doc's explicit non-requirements ("do not duplicate the full text... as a long static document"), the following guide content was **not** reproduced, only referenced by pointer, because it's descriptive/narrative rather than an operational rule the skill needs to act on:
- §2 "How We Work" narrative framing (used only as the one-line "GPT is still the brain" guardrail)
- §4 Operating Principles narrative (efficiency/no-hardcoding, "solution provider" framing) — omitted entirely as non-operational; flagged in Unresolved Ambiguities if this omission needs owner sign-off
- §14 Quick Reference Card — superseded by SKILL.md's own Reference sections, which cover the same ground at the level of detail Claude needs to act, not just recall

See `UNRESOLVED-AMBIGUITIES.md` for open questions this traceability pass surfaced.
