# Daily Work Log

Source: Mini-AIOS New Joiner Complete Guide §10. Separate from publishing output — this is where every developer records what they did each working day, so it becomes permanent, searchable company knowledge instead of living only in chat or memory.

**Different login required:** the `daily_task` schema is not reachable with the `temp_user` or `varmen_db` credentials — a separate, distinct login is needed. Ask Varmens; it's provided separately.

## The table

Every developer has their own table per project: `daily_task.tbl_<projectcode>_<developer>` — e.g. `tbl_invmgt_arun`, `tbl_wlsp_sarujanan`.

One row = one activity completed on one day. **The table is append-only:** INSERT a new row for each new activity — never overwrite or delete a previous day's rows.

## The 8 fields always filled

| Field | Meaning |
|---|---|
| `activity_id` | Unique ID, format `D<day>-A<seq>`, e.g. `D08-A01`. Check the last used ID before adding a new one. |
| `activity_date` | Date the work was done, `YYYY-MM-DD` |
| `developer` | Username |
| `project_code` | Short project code, matches the table name |
| `activity_type` | `development` / `devops` / `analysis` / `publication` / `bugfix` / `review` / `documentation` |
| `activity_title` | Short one-line title |
| `activity_summary` | What was done, how, and the outcome — written for a stranger to understand |
| `status` | `completed` / `in_progress` / `blocked` / `planned` |

Everything else (`systems_touched`, `evidence_refs`, `next_action`, `memory_tags`, etc.) is optional but recommended. `imported_at`, `created_at`, `updated_at` fill themselves — never touch them.

## Step by step

1. Find the last `activity_id`: `SELECT ... ORDER BY created_at DESC LIMIT 5`, so the new one is unique.
2. Fill in the 8 mandatory fields at minimum.
3. Run one INSERT per activity.
4. Verify: `SELECT ... WHERE activity_id = '...'` must return exactly one row, with `created_at` showing just now.

```sql
INSERT INTO daily_task.tbl_<projectcode>_<developer> (
    activity_id, activity_date, developer, project_code,
    activity_type, activity_title, activity_summary, status
) VALUES (
    'D01-A01', '2026-01-15', 'arun', 'INVMGT',
    'development', 'Built the low-stock alert query',
    'Wrote and tested a SQL query flagging SKUs below reorder point.',
    'completed'
);
```

## Common mistakes

| Mistake | Fix |
|---|---|
| Duplicate `activity_id` | Run the last-ID check first |
| UPDATE-ing an old row instead of INSERT-ing | Always INSERT a new row — history must stay intact |
| Vague `activity_summary` ("did some work") | Write what, how, and the result — assume the reader wasn't there |
| Filling `created_at`/`updated_at` manually | Leave them out — they auto-fill |
| Booleans as text (`'true'`) | Use unquoted `true` / `false` |

## Golden rule

Log every working day, at end of day. One activity = one row. Never rewrite history — correct a mistake with a new corrective row, not a delete. Verify after every insert.
