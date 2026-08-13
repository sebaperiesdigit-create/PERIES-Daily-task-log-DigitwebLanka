# Day-One Setup

Source: Mini-AIOS New Joiner Complete Guide §5. Work through these in order — don't let a joiner skip ahead to Section 6+ before finishing this, and don't let them skip a step because it looks optional.

Coach one step at a time: confirm the current step is genuinely done (or genuinely blocked) before moving to the next.

## 5.1 Create GitHub account

1. Sign up at github.com using the **company office Gmail address** — not a personal email.
2. Confirm the account and note the **exact username** — it gets used constantly.
3. Tell Varmens the GitHub username so they can add org/repo access where required.

## 5.2 Create the repository

Create their own repository, or their own top-level folder inside the assigned company repo if Varmens says one already exists for their team (ask if unsure). Name it clearly with their name or team — never a vague name like "test" or "new".

## 5.3 Install a tool

Any one of these — pick based on comfort, not capability, since all three run the same Claude Code:

| Option | Best if… |
|---|---|
| VS Code + Claude Code extension/terminal | Familiar code-editor feel, Source Control panel as Git GUI |
| Claude Code Desktop app | Simplest standalone experience, no separate editor |
| Claude Code in terminal / cmd | Comfortable working directly in a command line |

They can switch later without losing anything — real work lives in files and GitHub, not inside the tool.

## 5.4 Check connectors

Before any real work, confirm these are enabled in **both** Claude and Claude Code:

- `postgres` — read access to Developer 1's database (Varmen AIOS, Hub, static HTMLs)
- `LEDSone MCP` — read access to the LEDSone database (`varmen_db`)
- `LEDSone MCP DOC` — documentation/reference connector for the LEDSone database

**If any is missing: stop, ask Varmens. Never add personal database credentials as a workaround (see escalation-and-governance.md — Never Share Credentials).**

## 5.5 Build the folder skeleton

This uses the same GPT → Claude Code loop used for every task from here on — it's the joiner's first practice run. This is a GPT-planned build, not something this skill performs on its own initiative (see the skill's role-boundary note in SKILL.md): hand the joiner the exact prompt below to paste into a **new** ChatGPT chat, then relay ChatGPT's DISCOVERY prompt into Claude Code, then relay Claude Code's findings back to GPT, then relay GPT's BUILD prompt into Claude Code, then relay Claude Code's "what I built" output back to GPT for a PASS/fail check against folders-and-conventions.md.

Copy-paste prompt for a new ChatGPT chat (fill in name and repo URL first):

```
I'm a new staff member setting up my Mini-AIOS working folder for the
first time.

My name: [Your Name]
My GitHub repo: [repo URL]

Act as my planning brain for this setup (GPT = Brain, Claude Code =
Worker). Please:

1. Generate a Claude Code DISCOVERY prompt to check my GitHub repo for
   any existing folder structure or files, so I don't create duplicates.
2. After I paste back what Claude Code finds, review it and generate a
   Claude Code BUILD prompt that creates the full standard skeleton:
   evidence/, documentation/, handover/, closure/, validation/,
   workflows/, sql/, capability/, prompts/, data-maps/, query-packs/,
   duplicate-risk-reports/ — with a short README.md in each folder
   explaining its purpose, then pushes the result to GitHub.
3. After I paste back what Claude Code built, review it against the
   folder standard and tell me PASS or exactly what's missing.

Do not let me type build instructions directly into Claude Code —
always generate the exact prompt for me to paste.
```

If this Claude Code session is the same one the joiner will paste the DISCOVERY/BUILD prompts into, this skill (in Claude Code, where file/repo access exists) executes exactly what those GPT-generated prompts say — never a self-invented build plan.

## 5.6 Setup checklist — confirm all before starting real work

- [ ] GitHub account created with office Gmail
- [ ] Repository created and accessible
- [ ] One tool installed and working
- [ ] `postgres`, `LEDSone MCP`, and `LEDSone MCP DOC` connectors all enabled
- [ ] All standard folders exist, each with a README.md, pushed to GitHub
- [ ] Joiner knows where the shared task Google Sheet is, and can see their row when one is assigned

If any box can't be checked, that's the joiner's current blocker — don't let them move to real task work (task-workflow.md) until it's resolved or explicitly escalated to Varmens.
