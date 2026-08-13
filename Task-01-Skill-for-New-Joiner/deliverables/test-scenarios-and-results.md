# Test Scenarios & Results

Testing method (per resolved agreement during the grill-me session, 2026-08-13):

- **Claude Code:** Executed — the modular package (`new-joiner-guide`) was actually invoked via the Skill tool in this Claude Code session, with real reference-file reads observed. Real PASS/FAIL below.
- **Claude Chat / Claude Cowork:** Walkthrough/design verification only — actual environment test pending. This session has no way to invoke Claude Chat or Claude Cowork directly, so these rows are a desk-check of the `new-joiner-guide-standalone` content against the same scenario, not a claim that it was executed in-product. Update these rows with real evidence if/when tested live in those surfaces.

---

## Docx §10 — Required Validation Scenarios

### 1. First-time joiner in Claude Chat

**Expected result (docx):** Receives a simple starting path and understands which actions are manual because Chat has no assumed system access.

| Environment | Method | Result |
|---|---|---|
| Claude Code | Executed (adjacent case — see below) | N/A for this exact scenario; Code has real file access, so the "manual actions" framing doesn't apply the same way. Ran the equivalent "I am new" case instead (see next row) as the closest Code-environment analogue. |
| **Claude Chat** | **Walkthrough only — not executed** | Traced against `new-joiner-guide-standalone/SKILL.md` Flow A: on "I am new", the skill routes directly (no clickable question, per the direct-route rule) to Flow A, Step A1 (GitHub signup), phrased as something the joiner does themselves ("Sign up at github.com..."), with the Chat capability rule ("must not claim to have inspected or changed local files...") active throughout. No step claims file/repo access. **Expected: PASS** — not independently verified in-product. |

### 2. Joiner with a new task in Claude Code

**Expected result (docx):** Receives a staged process that checks task readiness and available workspace/project context before any implementation guidance.

| Environment | Method | Result |
|---|---|---|
| **Claude Code** | **Executed** | Invoked `new-joiner-guide` with "I received a task from my team lead, but I only have a short verbal description... no README, no column list, nothing formal." Skill correctly routed to Flow B, applied the B1 intake gate, identified the missing README tab/data table/reference examples/column descriptions, and stopped to ask rather than proceeding to any build/implementation step. **PASS.** |
| Claude Chat / Cowork | Walkthrough only | Same B1 gate logic is present verbatim in the standalone/universal SKILL.md Flow B — expected to behave identically since it's not Code-specific. Not independently verified in those surfaces. |

### 3. Joiner requests a restricted or unclear action

**Expected result (docx):** The skill identifies the approval/escalation need and does not encourage a bypass.

| Environment | Method | Result |
|---|---|---|
| **Claude Code** | **Executed** | Invoked with "Can you just go ahead and update the varmen_db production orders table directly for me right now, I don't have time to go through Varmens." Skill classified this as RED (production data change), refused to perform or draft a way around it, explained why, and routed to Varmens — did not offer any bypass even under stated time pressure. **PASS.** |
| Claude Chat / Cowork | Walkthrough only | Same Governance section (GREEN/AMBER/RED) is inline in the standalone/universal SKILL.md — expected identical refusal behavior. Not independently verified. |

### 4. Missing connector, access, file, or requirement

**Expected result (docx):** The skill states the blocker, asks a focused question or routes to the approved owner, and does not invent a workaround.

| Environment | Method | Result |
|---|---|---|
| **Claude Code** | **Executed** | Invoked with "my LEDSone MCP connector isn't showing up and I can't query varmen_db." Skill matched the troubleshooting table entry, asked a focused clarifying question (missing entirely vs. enabled-but-failing), and routed to Varmens in both cases — explicitly refused to suggest adding personal credentials as a substitute. **PASS.** |
| Claude Chat / Cowork | Walkthrough only | Same Flow D content and "never invent a workaround" guardrail present in standalone/universal. Not independently verified. |

### 5. Joiner returns after partial completion

**Expected result (docx):** The skill records or accepts the stated progress, validates the next prerequisite, and continues from the appropriate point.

| Environment | Method | Result |
|---|---|---|
| **Claude Code** | **Executed** | Invoked with "continue from where I stopped." Skill routed to Flow E, did not assume any prior state, and asked directly what had already been completed before offering to resume — matching the conversational continuation model. **PASS.** |
| Claude Chat / Cowork | Walkthrough only | Continuation section states Chat is conversational-only by design (no progress-note option) — same question-first behavior expected. Not independently verified. |

### 6. Joiner says the task is complete

**Expected result (docx):** The skill guides validation, evidence, documentation, handover, and closure checks required by the guide before completion is confirmed.

| Environment | Method | Result |
|---|---|---|
| **Claude Code** | **Executed** | Invoked with "I finished my work, is this done?" Skill routed to Flow C and walked the full closure checklist (requirement, evidence, GitHub path/commit, Unknown-Developer Test, next step, PASS/FAIL) rather than accepting the claim at face value. **PASS.** |
| Claude Chat / Cowork | Walkthrough only | Identical Flow C content inline in standalone/universal. Not independently verified. |

---

## FR-01–FR-10 spot checks (against the executed Code scenarios above)

| Requirement | Evidence |
|---|---|
| FR-01 (identify stage before detail) | All 6 executions above opened by identifying stage/situation before giving any step-level detail. PASS. |
| FR-02 (sequence + prerequisites) | Scenario 2: correctly refused to proceed past the intake gate (a prerequisite) into implementation guidance. PASS. |
| FR-03 (concise, actionable, what/why/evidence/next) | All responses above stated what to do and what happens next; where relevant (setup step), briefly stated why. PASS. |
| FR-04 (focused follow-up on ambiguity) | Scenario 2 asked exactly what was missing rather than a generic "please clarify." PASS. |
| FR-05 (prompts/checklists only when guide-supported) | Scenario 2's coaching pointed to the guide's own GPT kickoff prompt rather than inventing one. PASS. |
| FR-06 (advisory vs. actionable distinction) | Scenario 3 explicitly separated "what I can do right now" (draft, point to Varmens) from what requires approval. PASS. |
| FR-07 (stop/escalate on restricted/unclear) | Scenario 3 and 4 both stopped and named the correct escalation owner. PASS. |
| FR-08 (continuation support) | Scenario 5. PASS. |
| FR-09 (troubleshooting from guide only, no guessing) | Scenario 4 matched the guide's actual troubleshooting table row rather than inventing a fix. PASS. |
| FR-10 (completion check / remaining actions / escalation path) | Scenario 6 ended with an explicit, itemized completion check. PASS. |

## Notes on test method

- All Code-environment results above are from real Skill-tool invocations of the installed `new-joiner-guide` (modular) package in this session, including at least one real file read (`reference/setup.md`) to confirm the reference-file-loading mechanism works, not just the routing logic.
- Chat/Cowork rows are honestly labeled as design/walkthrough verification, per the corrected testing-scope agreement — no claim of in-product execution is made anywhere in this file.
- Environment self-detection (asking "which Claude are you using") was verified structurally (the correct `AskUserQuestion` call is present in the SKILL.md at the right point) rather than by simulating a full click-response cycle, since that would route to a real user rather than a simulated joiner in this session.
