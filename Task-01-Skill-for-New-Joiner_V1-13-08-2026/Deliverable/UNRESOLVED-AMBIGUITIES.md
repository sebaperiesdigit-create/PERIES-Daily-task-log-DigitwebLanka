# new-joiner-guide — Unresolved Ambiguities Requiring Owner Decision

Per docx §13 Handover Package. These are gaps or judgment calls made while authoring the skill that a human owner should confirm or correct — none of them were invented as rules inside the skill; where genuinely unclear, the skill is written to ask/escalate rather than assume.

1. **Guide is explicitly a living document — no defined sync process for the skill.**
   §2.1 of the guide states the workflow "changes — sometimes weekly, sometimes monthly." `SKILL.md` embeds a distilled, static snapshot of the guide's rules (by design, so it works with zero file access in Claude Chat — see below). Neither source doc says who is responsible for updating `SKILL.md` when the guide changes, or how often to check.
   **Owner:** Varmens (guide maintainer). **Suggested resolution:** assign guide-update → skill-update as a standing task, or a review cadence.

2. **Single-file packaging deviates from this repo's own skill-authoring convention.**
   This project's `CLAUDE.md`/`skill-builder` reference mandates SKILL.md stay under ~500 lines with detail pushed into supporting files. Per explicit instruction in this session, `new-joiner-guide` was built as one self-contained file with no supporting files at all (it came out to ~275 lines, so the line-count concern didn't materialize, but the "no supporting files" choice itself is a deliberate deviation from house style). Flagging so it's a recorded decision, not a silent one.
   **Owner:** whoever owns this repo's skill conventions (project owner). **Suggested resolution:** ratify as an accepted exception, or request a follow-up split into supporting files later.

3. **Evidence bar for "continuation" claims in Claude Chat/Cowork is undefined.**
   In Claude Code, the skill can check `evidence/`/`handover/` files directly before accepting a joiner's stated progress (per the Evidence Rule, §12.2). In Claude Chat or a Cowork session with no file access, there is no way to independently verify a self-reported "I already did X" — the skill can only ask more questions, not check. Neither source doc specifies how hard to push in that situation, or whether verbal confirmation is an acceptable evidence substitute when no tool access exists.
   **Owner:** Tamil Selvan (Queryability/Evidence Reviewer). **Suggested resolution:** define an explicit fallback evidence bar for no-file-access environments (e.g., "ask for a pasted file path or commit link, don't just accept a verbal yes").

4. **§4 "Operating Principles" (efficiency-first / solution-provider mindset) was omitted as non-operational.**
   These are cultural/motivational framing rather than step-by-step instructions, so they weren't carried into `SKILL.md` (see `TRACEABILITY.md`). It's a judgment call that this section doesn't need active enforcement by a coaching skill.
   **Owner:** Varmens / MD. **Suggested resolution:** confirm this is out of scope for the skill, or specify what "enforcement" would even look like (e.g., flag hardcoded values if Claude Code sees them).

5. **Definition of "sensitive / internal-HR-only" content before a wider-audience publish (§9.4) is not specified anywhere.**
   The guide's pre-push checklist requires confirming "nothing sensitive/internal-HR-only" is in output meant for a wider audience, but neither source document defines what counts as sensitive in this context.
   **Owner:** Varmens / MD. **Suggested resolution:** either provide a short definition/checklist, or confirm this stays a human judgment call the skill should always defer to Varmens on (current behavior: skill treats this as a standing pre-push question, doesn't try to classify content itself).

6. **Final skill name was chosen directly by the requester in this session, not by Varmens/MD.**
   The requirement doc asks for "a clear, stable, company-appropriate name" without specifying an approval step. `new-joiner-guide` was picked via direct instruction here; no company naming-convention owner was consulted.
   **Owner:** Varmens / MD. **Suggested resolution:** confirm the name before wider rollout, or rename if it collides with a naming convention not visible in these source docs.
