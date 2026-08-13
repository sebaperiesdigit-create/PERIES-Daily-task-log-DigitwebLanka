# Source / Requirement Traceability Note

Maps every operational rule embedded in `new-joiner-guide` (all three variants) back to the Mini-AIOS New Joiner Complete Guide ("Guide") section or the Task-01 Requirements docx ("Docx") requirement that authorizes it. Nothing in the skill originates outside these two sources plus the user-approved "Master Planning Prompt" design document ("Design Doc") for UX/conversation behavior.

| Skill content | Source |
|---|---|
| GPT=Brain/Claude Code=Worker role boundary; skill never invents its own plan | Guide §1.1, §2.2, §8.5, §13 (troubleshooting entry); Docx §7 "Never bypass approvals... make business-rule decisions"; Design Doc "Core Workflow Principles" |
| Flow A — GitHub/repo/tool/connector/folder-skeleton setup steps | Guide §5.1–5.6 |
| Copy-paste ChatGPT setup prompt | Guide §5.5 (verbatim template) |
| Business glossary (SKU, marketplace, platform, brand, sales data, ads) | Guide §3.1–3.3 |
| Standard folder table, per-task subfolder pattern, forbidden names | Guide §6 |
| SKILL.md vs CLAUDE.md distinction | Guide §6.1 |
| Two-database table, read/write access rules, credential rule | Guide §7.1–7.3 |
| Task requirement format (README tab/data table/examples/columns) | Guide §8.2 |
| Standard task loop + ChatGPT kickoff prompt | Guide §8.3 |
| Automating output vs manual regen; design-vs-execute automation distinction | Guide §8.4; Design Doc "Automation Safety" (explicit design/execute split not stated verbatim in Guide but a reasonable safety-preserving elaboration approved via Design Doc) |
| First-few-tasks GPT-first rule | Guide §8.5 |
| Task closure checklist | Guide §8.6 |
| Publishing destination confirmation rule; Varmen AIOS/Hub fields + push script; PH Team Board columns; varmen_db migration; pre-push checklist | Guide §9.1–9.4 |
| Daily log table pattern, 8 fields, step-by-step, common mistakes, golden rule | Guide §10.1–10.5 |
| Taking-over-a-task steps + prompt | Guide §11 |
| GREEN/AMBER/RED table | Guide §12.1 |
| Evidence Rule | Guide §12.2 |
| Existing Asset First | Guide §12.3 |
| Unknown-Developer Test | Guide §12.4 |
| Never share credentials with AI | Guide §12.5, §7.3 |
| Troubleshooting table | Guide §13 |
| Quick reference card (escalation-and-governance.md) | Guide §14 |
| Who-to-ask table (Varmens/Sajeesan/Tamil Selvan/MD) + contact email | Guide §1.3 |
| Skill must identify stage before detailed instructions | Docx FR-01 |
| Logical sequencing, prerequisites before dependent steps | Docx FR-02 |
| Concise, actionable responses (what/why/evidence/next) | Docx FR-03 |
| Focused follow-up questions on ambiguity | Docx FR-04 |
| Reusable prompts/checklists only when guide-supported and environment-appropriate | Docx FR-05 |
| Distinguish advisory guidance from actions Claude can actually perform | Docx FR-06; Design Doc "Status Language" |
| Stop and request approval/escalation on restricted/unclear/owner-controlled items | Docx FR-07 |
| Continuation support ("what have you already done") | Docx FR-08; Design Doc "Interaction Requirements" (current stage as clickable question) |
| Troubleshooting from the guide only, no guessing | Docx FR-09 |
| End each flow with completion check / remaining actions / escalation path | Docx FR-10 |
| Per-environment required behavior (Chat/Cowork/Code capability rules) | Docx §5; Design Doc "Platform-Aware Behaviour" |
| Entry-point routing table (I am new / received a task / finished my work / can't access / continue from where I stopped) | Docx §6; Design Doc "Entry-Point Behaviour" |
| Direct-route-when-clear vs ask-when-unclear (correction applied during grill session) | User correction during grill-me session, 2026-08-13 |
| Safety/governance rules (no secrets, no false completion claims, no bypassing approvals, distinguish guidance/action/human-owner) | Docx §7 |
| Mandatory clickable-question convention for finite-answer questions | This repo's `skill-builder` reference.md — Interaction Convention (house convention, not guide-specific, applied per CLAUDE.md instruction) |
| Skill name, packaging as reusable Skill format, portability requirement (works with zero file/tool/connector access) | Docx §8 (Deliverable Requirements: Skill format, Portability) |
| Status vocabulary (Planned/Waiting/Blocked/Inspected/Built/Validated/Ready for publishing/Published/Closed) | Design Doc "Status Language" (not in Guide verbatim; an explicit, approved elaboration to make FR-06's advisory/action distinction visible to the joiner) |
| Progressive disclosure conversation design | Design Doc "Conversation Design Principles", "Non-Negotiable User Experience Rule" |
| Guide-freshness marker, reactive-only staleness flagging | Guide §2.1–2.2 (workflow changes, principles constant); resolved via grill-me session, corrected wording 2026-08-13 |
| Three-package architecture (Modular/Standalone/Universal) sharing canonical content | Resolved via grill-me session 2026-08-13, per user direction |

## Explicitly NOT sourced from the guide (flagged separately)

See `unresolved-guide-ambiguities.md` for points where the guide is genuinely silent and the skill's behavior is "stop and ask Varmens" rather than a guide-derived rule.
