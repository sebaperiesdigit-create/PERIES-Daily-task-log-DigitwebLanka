# Task: Gmail Loan Requests to HTML Tracker

Build the first safe, testable version of an internal automation that converts authorised welfare loan-request emails into an updated HTML table.

## Business goal

Welfare/admin staff need one clear table of loan requests instead of manually reading and retyping information from Gmail.

Each qualifying loan-request email must create or update one record containing:

| Date | Requested By | Amount | Reason | Loan Type |

The data must come from the email content.

## Scope

1. Inspect the existing repository and its conventions before making changes.
2. If the project already has an application, add this feature using its existing stack and patterns.
3. If no suitable application exists, create the smallest maintainable local implementation required for this feature.
4. Build a durable request-record model. A continuously updated table must survive reruns/restarts.
5. Generate a staff-facing HTML table containing only the five required business columns.
6. Build the extraction/import flow so it is configurable and testable with synthetic or redacted email fixtures.
7. Ensure rerunning the same email never creates a duplicate row. Store a stable source identifier privately, such as Gmail message ID.
8. Handle incomplete or unclear emails safely. Do not guess a name, amount, reason, date, or loan type. Mark the record as needing review internally instead.
9. Escape all extracted values before rendering HTML.

## Gmail and database boundaries

- Do not connect to a live Gmail account yet.
- Do not ask for or expose passwords, OAuth tokens, API keys, or connection strings.
- Do not scrape Gmail.
- Prepare the integration for an authorised Gmail API connection using least-privilege access, but use safe fixtures until the Gmail account and qualifying-email rule are confirmed.
- Do not use a Varmen database yet. Use the project’s existing approved storage if available; otherwise use a safe local development store.
- If Varmen database access is approved later, before any write run:

  `SELECT current_database(), current_user;`

  Stop before writing if either value does not exactly match the approved database and user. Never print database credentials.

## Important unknowns — do not invent them

These must remain configurable or be reported as blockers:

- Gmail account and mailbox/label to monitor
- Exact qualifying rule: sender, subject, Gmail label, or approved search query
- Real email template and field wording
- Whether `Date` means Gmail received date or the date written in the request
- Allowed loan-type values
- HTML table destination and authorised users
- Historical-email import requirement
- Review/approval process for incomplete requests

## Required first delivery

Implement the safe local foundation and provide:

1. A short architecture summary.
2. The data schema, including private source ID, received time, parse status, and error/review information.
3. Redacted or synthetic test-email fixtures.
4. Extraction logic for the five business fields, designed to be configurable once real samples are supplied.
5. Persistent local storage and duplicate protection.
6. An HTML table view with an empty state.
7. Tests proving:
   - one qualifying fixture creates one correct table row;
   - an ineligible fixture creates no row;
   - rerunning an email does not duplicate it;
   - missing or malformed fields cannot corrupt the table;
   - HTML characters in email values render safely as text;
   - saved rows remain after restart/rerun.
8. Safe setup and run instructions.
9. A concise list of exact information still needed before live Gmail activation.

## Completion boundary

Do not activate scheduled syncing, connect production Gmail, send emails, or write to a production database without explicit approval. Keep changes focused on this task and report changed files plus test evidence.