# Task Intake & the Standard Task Workflow

Source: Mini-AIOS New Joiner Complete Guide §8. This is the routine every new task follows. **This coaching skill never writes the planning prompts itself — it hands the joiner the guide's own template, filled in with their specifics, to paste into a new ChatGPT chat.** GPT plans; Claude Code executes what GPT produces.

## Task requirement format — check before proceeding

Every requirement, from anyone, should be a Google Sheet containing:

| Tab / Section | Contents |
|---|---|
| README tab | Self-explanatory description of what's being requested and why |
| Data table needed | The exact table/columns the requester wants to see |
| Reference examples | 3–5 sample rows of real or representative data |
| Column descriptions | What each column means — no guessing required |

**If any of these is missing:** identify exactly what's missing and ask for it, or route to whoever assigned the task. Do not silently fill the gap or guess at intent.

## The standard loop

1. Create a new GPT Project for the task, with: the Project Instructions + the task requirement file (from the Google Sheet) + a PostgreSQL database-structure file (which data lives where).
2. Ask GPT to discover the database for similar or related tasks first (**Existing Asset First** — don't rebuild something that already exists).
3. Get the standard folder-creation prompt from GPT → run it in Claude Code.
4. Claude Code auto-saves task files as it works: `handover/`, `evidence/`, `prompts/`, plus a `CLAUDE.md` and a README for the task.
5. Finish: generate the HTML view → push it to the assigned URL (database-and-publishing.md) → push the work to GitHub.

Copy-paste prompt for a new ChatGPT chat to kick off any new task (fill in the requirement and any known DB notes):

```
I have a new task requirement from the team (from our shared Google
Sheet, with a README tab, the data table needed, reference examples,
and column descriptions). Act as my planning brain for this task
(GPT = Brain, Claude Code = Worker).

Task requirement (pasted from the sheet):
[paste the requirement details here]

PostgreSQL database-structure notes (if I have them):
[paste or describe which database/tables are relevant, if known]

Please:
1. Ask me anything you need to clarify the requirement, scope, and
   expected output.
2. Tell me how to discover whether a similar or related task already
   exists in our database or folders, so we don't duplicate it.
3. Generate the Project Instructions for a new dedicated GPT project
   for this task.
4. Generate a task-specific SKILL.md, adapted only from the standard
   Mini-AIOS rules, scoped to this task.
5. Generate the standard folder-creation prompt to run first in
   Claude Code, followed by the first DISCOVERY prompt.

I will create a brand-new GPT project for this task, paste in your
Project Instructions and this SKILL.md as the Source, and only then
start running Claude Code prompts from that project.
```

## Automating output (once stable)

Once a task's HTML view is working, add automation so it refreshes on its own — daily, weekly, or monthly, based on how often the underlying data actually needs to update. Manual regeneration is the fallback once a task is in steady use, not the default forever.

**Important distinction (do not blur this):** *preparing/documenting/designing* automation is different from *enabling/deploying/executing* live automation. Live automation execution is a RED governance item (escalation-and-governance.md) — never treat "let's automate this" as permission to actually turn it on without the required approval.

## The first-few-tasks rule

| Stage | Rule |
|---|---|
| First few tasks | Always go GPT → prompt → Claude Code. No exceptions while learning the pattern. Do not encourage an inexperienced joiner to skip this. |
| Once the pattern is known | May type prompts directly into Claude Code without a fresh GPT round-trip — but GPT-first remains the recommended default, especially for anything non-trivial. |

If a joiner (mid-conversation) seems to be asking this skill to just decide what to build instead of going through GPT, and they're still on their first few tasks: stop, and route them back to the GPT prompt above rather than deciding for them.

## Task closure — before calling a task done

The closure note (saved in `closure/`) should answer:

- What was the requirement?
- What asset/evidence exists, and where?
- What is the GitHub path or commit?
- Can someone else continue this without asking? (see takeover-and-closure.md)
- What's the one next step?
- PASS or FAIL?

Don't let a joiner declare a task complete without walking through this list — this is the "I finished my work" entry point's job (see SKILL.md).
