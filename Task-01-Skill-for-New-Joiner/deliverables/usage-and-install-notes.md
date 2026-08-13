# new-joiner-guide — Usage & Install Notes

## What it does

An interactive coach for Mini-AIOS new joiners, usable in Claude Chat, Claude Cowork, and Claude Code. It identifies where a joiner is (new/setup, has a task, finished work, blocked, resuming, taking over, logging work, publishing) and walks them through the real Mini-AIOS New Joiner Complete Guide's process one step at a time — setup, task workflow, database/publishing rules, daily logging, takeover, and closure. It hands the joiner the guide's own copy-paste ChatGPT prompts at the right moments and never invents its own build/task plan. When something is restricted, unclear, or the guide is silent, it stops and routes to the correct named owner (Varmens / Sajeesan / Tamil Selvan / MD) instead of guessing.

## What it does NOT do

- It does not change company policy, governance, roles, or workflow rules.
- It does not build new company applications, dashboards, connectors, or automations.
- It does not replace ChatGPT's planning role — for real task work it hands the joiner the guide's own paste-into-ChatGPT prompts rather than writing its own.
- It does not claim to access, change, or verify anything the current Claude environment can't actually do.
- It never requests, stores, echoes, or fabricates credentials.
- It is not a general-purpose company assistant — it stays scoped to new-joiner onboarding guidance.

## The three variants — install exactly ONE per environment

All three are the same skill (`name: new-joiner-guide` in every variant's frontmatter) — they share identical Mini-AIOS rules and behavior, packaged differently. **Installing more than one variant into the same skills scope (e.g. two of them both under `.claude/skills/`, or both under `~/.claude/skills/`) will duplicate/conflict, since they define the same skill name.** Pick the one variant matching where the skill will actually be used.

| Variant | Folder | Use in | Why |
|---|---|---|---|
| **Modular** | `.claude/skills/new-joiner-guide/` | Claude Code only | Thin `SKILL.md` routing engine + `reference/*.md` topic files, loaded on demand. Leanest option and easiest to keep current, but depends on file access to load the reference files — only works where Claude Code's file tools are available. |
| **Standalone** | `.claude/skills/new-joiner-guide-standalone/` | Claude Chat or Claude Cowork only | One complete, self-contained `SKILL.md` — everything inline, zero dependency on supporting files. Works even with no local file/tool/connector access, per the docx portability requirement. |
| **Universal** | `.claude/skills/new-joiner-guide-universal/` | Any environment, or a joiner who moves between surfaces | The same complete, self-contained `SKILL.md` as Standalone, PLUS the same `reference/*.md` files as Modular bundled alongside as optional deeper-dive material. The skill never depends on the reference files being present — they're a convenience when file access happens to exist. |

## Install

Skills in this repo live under `.claude/skills/<name>/`. To install a variant:

1. Choose the one variant appropriate to the target environment (table above).
2. Copy that variant's whole folder into the skills location for the target scope:
   - **Project-level** (this repo or another project): `.claude/skills/<variant-folder-name>/`
   - **Personal, all projects**: `~/.claude/skills/<variant-folder-name>/`
3. Do not also copy a second variant into the same scope.
4. In Claude, the skill auto-invokes on matching natural language (e.g. "I am new", "I received a task") or via `/new-joiner-guide`.

For Claude Chat and Claude Cowork specifically: how a Skill package gets uploaded/enabled is controlled by that surface's own settings/UI, which this document does not have first-hand access to confirm — check the current Claude Chat/Cowork skill-upload flow at the time of install rather than assuming a specific menu path, since the guide and docx don't document one.

## Keeping it current

Each variant's `SKILL.md` header states: "Synced against the project-provided Mini-AIOS New Joiner Complete Guide on 2026-08-13." The guide itself says workflow specifics may change weekly/monthly while core principles stay constant (guide §2.1–2.2). When the guide changes in a way that affects this skill's content, update the canonical sources and re-copy into all three variants that use them:

- Canonical reference topics: `.claude/skills/new-joiner-guide/reference/*.md` (also copied into `new-joiner-guide-universal/reference/`)
- Canonical self-contained body: `new-joiner-guide-standalone/SKILL.md` (same body also lives in `new-joiner-guide-universal/SKILL.md`, with an added header and inline "deeper reference, optional" pointers)

Update the synced-as-of date in all three `SKILL.md` headers when content changes.
