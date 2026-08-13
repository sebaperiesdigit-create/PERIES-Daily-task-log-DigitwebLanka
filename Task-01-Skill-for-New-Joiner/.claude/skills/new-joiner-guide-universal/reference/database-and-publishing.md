# Databases & Publishing

Source: Mini-AIOS New Joiner Complete Guide §7, §9. Default to read-only thinking: pulling/analyzing data is routine (GREEN), but writing to a database or publishing output requires the confirmations below (see escalation-and-governance.md for GREEN/AMBER/RED).

## The two databases

| Database | What's in it | Read access | Write access |
|---|---|---|---|
| `postgres` (Developer 1) | Varmen AIOS, the Hub, and static HTML outputs. Not yet migrated — currently kept as a backup. | `postgres` MCP connector | `temp_user` credential (ask Varmens) — covers Varmen AIOS and PH task pushes |
| LEDSone (Developer 2) | `varmen_db` — the currently active working database | `LEDSone MCP` connector | Separate credential, issued by Varmens on request |

**If a task needs write access:** the default answer is `varmen_db`. Contact Varmens for write-access credentials — never assume existing ones still apply, and never reuse credentials from a previous task without checking they're current.

**Never share passwords with Claude or GPT — strict rule, no exceptions.** Never paste database passwords, connection strings, or any other credentials into a Claude or GPT conversation, prompt, or file that gets committed anywhere. Connectors are configured outside the chat for exactly this reason — use them instead of typing credentials in.

## Where output gets published

**This is decided per task by the team lead (Varmens), not fixed by this guide.** It could be the existing Varmen AIOS/Hub, a newly created destination, or a migration into `varmen_db`. Always confirm before publishing rather than assuming — creating an HTML file is not the same as publishing it.

### If assigned Varmen AIOS / Hub

Required fields, every time, no exceptions:

| Field | Rule |
|---|---|
| `member_name` | Always the joiner's own name, spelled identically every time — lowercase, e.g. `apirame`, never `Apirame` or a nickname |
| `page_slug` | Short, URL-safe, unique to them, e.g. `july-inventory-check`. Re-using a slug **updates** that dashboard instead of duplicating it |
| `page_title` | Human-readable name shown on the Hub |
| `html_content` | One complete, self-contained HTML file — inline all CSS/JS, no external `<script src>` or `<link>` references |

Steps:
1. Build and finish the dashboard exactly as normal; sanity-check it renders correctly as a standalone file first.
2. Save the finished HTML to a file on disk — don't paste large HTML directly into a Claude Code prompt.
3. Ask Varmens for the current push script and connection string for this destination.

```bash
# Git Bash / macOS / Linux (tested path):
export HUB_DB_URL="<value Varmens gives you>"
node push_to_hub.js --member "your_name" --slug "your-dashboard-slug" \
  --title "Your Dashboard Title" --file "./your-dashboard.html"
```

Plain PowerShell's `$env:` syntax works differently with this script — use Git Bash instead, or ask Varmens.

### If assigned the PH Team Board

PH is a team name. Their tool reads task rows from `tech_team_outputs.ph_task` — the developer writes a row as HTML; the PH end user sees it, acts on it, and their action is recorded back onto the same row.

| Column | Who fills it / meaning |
|---|---|
| `project_name`, `project_code`, `task_name` | Developer — required, identify the task |
| `task_id`, `team`, `developer` | Developer — team = responsible team, developer = the joiner |
| `assigned_user` | Developer — the PH end user expected to act |
| `html_content` | Developer — the task body as HTML, shown in the tool |
| `description` | Developer — free-text detail |
| `phase_level`, `version_level`, `version_status` | Developer — defaults 0 / 0 / blank; set only if the task tracks phases/versions |
| `action_took_by`, `action_took_date_time` | Left NULL by the developer — filled in when the task is completed |
| `created_at`, `updated_at` | Auto — never fill manually |

### If migrating into `varmen_db`

Ask Varmens for current write credentials and the target table/schema **before** pushing anything new here — this destination is actively used for day-to-day work, so confirm naming with Varmens to avoid clashing with existing data.

## Checklist before any push

- [ ] HTML is fully self-contained (opens correctly as a standalone file)
- [ ] Destination confirmed with Varmens — not assumed
- [ ] Naming (`member_name` / slug / `project_code`, as relevant) matches prior convention
- [ ] Nothing sensitive / internal-HR-only in output meant for a wider audience

If any box can't be checked, stop and escalate to Varmens rather than publishing anyway.
