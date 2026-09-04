/** Escapes text for safe placement inside HTML element content. */
export function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Status badge (6th column, v7) - a different kind of status from
 * parseStatus: not "did we read this correctly" but "where does it stand
 * with staff". See config.js statusStaffAddress/statusScheduledPattern.
 */
function renderStatusBadge(status) {
  const value = status || "Submitted";
  let className = "status-neutral";
  if (value.startsWith("Scheduled")) className = "status-scheduled";
  else if (value === "Needs manual review") className = "status-badge";
  return `<span class="${className}">${escapeHtml(value)}</span>`;
}

function renderMainRows(records) {
  if (records.length === 0) {
    return `      <tr class="empty-row">
        <td colspan="6">No loan requests recorded yet.</td>
      </tr>`;
  }
  return records
    .map(
      (r) => `      <tr>
        <td>${escapeHtml(r.date)}</td>
        <td>${escapeHtml(r.requestedBy)}</td>
        <td class="num">${escapeHtml(r.amount)}</td>
        <td>${escapeHtml(r.reason)}</td>
        <td><span class="badge">${escapeHtml(r.loanType)}</span></td>
        <td>${renderStatusBadge(r.status)}</td>
      </tr>`
    )
    .join("\n");
}

/**
 * A staff-usable Gmail deep link built from the message id we already store.
 * Assumes the viewer is signed into the relevant mailbox as their primary
 * ("u/0") Google account in that browser - documented limitation, not
 * guaranteed for everyone. Harmless (a dead link) against demo/fixture data,
 * whose source ids aren't real Gmail message ids.
 */
function gmailMessageLink(sourceId) {
  return `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(sourceId)}`;
}

/** Renders whichever of the 4 body fields DID extract successfully, so staff aren't flying blind. */
function renderExtractedSoFar(record) {
  const found = [
    ["Requested By", record.requestedBy],
    ["Amount", record.amount],
    ["Reason", record.reason],
    ["Loan Type", record.loanType],
  ].filter(([, value]) => value !== null && value !== undefined && value !== "");

  if (found.length === 0) {
    return `<span class="muted-inline">Nothing usable extracted yet</span>`;
  }
  return found.map(([label, value]) => `<strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}`).join(" &nbsp;·&nbsp; ");
}

/**
 * A record lands in the review queue for one of two DIFFERENT reasons,
 * rendered with distinct wording (added 2026-09-04, per explicit user
 * request):
 *   - "extraction": parseStatus is "needs_review" - a business field
 *     (Requested By/Amount/Reason/Loan Type) is genuinely missing. Fixed
 *     via data/live/corrections.json (see the section note below).
 *   - "status": parseStatus is "ok" (a fully valid, complete request -
 *     ALSO shown in the main table above, on purpose - pulling it out
 *     would hide legitimate business data) but Loan Status is "Needs
 *     manual review" - staff replied, but the wording didn't match the
 *     recognized "Scheduled for <Month>" pattern. Fixed differently: staff
 *     replies again in the same Gmail thread with that recognized wording
 *     - `detectLoanStatus` (src/pipeline.js) automatically picks up the
 *     newest staff reply on the next run. Deliberately NOT resolvable via
 *     corrections.json - that would create two competing ways to set the
 *     same field, and staff are the sole authority on Loan Status.
 */
function renderReviewRows(records) {
  if (records.length === 0) {
    return `      <tr class="empty-row">
        <td colspan="4">Nothing pending review.</td>
      </tr>`;
  }
  return records
    .map((r) => {
      const isStatusReview = r.parseStatus === "ok";
      const badgeLabel = isStatusReview ? "Loan status review" : "Needs review";
      const note = isStatusReview
        ? `Staff replied but the wording wasn't recognized as a schedule. Reply again in this thread with "Scheduled for &lt;Month&gt;" to resolve - picked up automatically on the next run.`
        : escapeHtml(r.reviewNotes);
      return `      <tr>
        <td>
          ${escapeHtml(r.date)}<br>
          <span class="muted-inline">${escapeHtml(r.fromAddress)}</span><br>
          <span class="muted-inline">${escapeHtml(r.subject)}</span>
        </td>
        <td>${renderExtractedSoFar(r)}</td>
        <td><span class="status-badge">${badgeLabel}</span> ${note}</td>
        <td>
          <a class="open-link" href="${escapeHtml(gmailMessageLink(r.sourceId))}" target="_blank" rel="noopener noreferrer">Open email &#8599;</a><br>
          <code class="chip">${escapeHtml(r.sourceId)}</code>
        </td>
      </tr>`;
    })
    .join("\n");
}

/**
 * Renders the full standalone HTML page (self-contained: inline CSS, no
 * third-party assets, no network calls) from the current record set.
 *
 * The main table shows the 5 original business columns plus a 6th, "Status"
 * (v7, 2026-09-03 - formally revised from the original "exactly 5 columns"
 * requirement), and ONLY records with parseStatus "ok". Records needing
 * review are listed separately, by source id and review note only - never
 * with invented business-field values.
 *
 * Visual design only below this point (colors/spacing/typography) - the data
 * selected, escaped, and rendered is unchanged from the plain version. Loan
 * Type is shown as a plain neutral badge (not color-coded by category) - see
 * config.js `loanTypeKeywords`. Coloring by category would invent visual
 * structure the business hasn't approved yet.
 */
export function renderHtml(records, { generatedAt = new Date().toISOString() } = {}) {
  const valid = records
    .filter((r) => r.parseStatus === "ok")
    .sort((a, b) => (a.date || "").localeCompare(b.date || "") || a.sourceId.localeCompare(b.sourceId));
  const needsReview = records
    .filter((r) => r.parseStatus === "needs_review")
    .sort((a, b) => a.sourceId.localeCompare(b.sourceId));
  // Added 2026-09-04, per explicit user request: an "ok" record whose Loan
  // Status is "Needs manual review" is ALSO listed in the review queue
  // below (with distinct wording - see renderReviewRows), so staff have an
  // actionable place to notice it, not just a badge buried in the main
  // table. It stays in `valid`/the main table too - it's a fully valid,
  // complete request, not an extraction problem.
  const statusNeedsReview = valid.filter((r) => r.status === "Needs manual review");
  const reviewQueue = [...needsReview, ...statusNeedsReview].sort((a, b) => a.sourceId.localeCompare(b.sourceId));

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Welfare Loan Requests</title>
<style>
  :root {
    color-scheme: light;
    /* Chrome & ink - from the validated reference palette (light surface set). */
    --page-bg: #f9f9f7;
    --surface: #fcfcfb;
    --text-primary: #0b0b0b;
    --text-secondary: #52514e;
    --text-muted: #898781;
    --gridline: #e1e0d9;
    --hairline: rgba(11, 11, 11, 0.10);
    --shadow: 0 1px 2px rgba(11, 11, 11, 0.04), 0 4px 12px rgba(11, 11, 11, 0.05);

    /* Accent (kept as the existing navy, refined) - used for the table header
       and Loan Type badges. Not a categorical/status color; one fixed hue. */
    --accent: #1f3a5f;
    --accent-muted: #5a7392; /* lighter step of the same navy - secondary table header */
    --accent-tint: #e7edf4;
    --accent-fg: #ffffff;

    /* Status "warning" - reserved, used only for the awaiting-review signal,
       always paired with an icon + text label, never carrying meaning alone. */
    --status-warning: #fab219;
    --status-warning-ink: #8a5a05;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 2rem 1.5rem 3rem;
    background: var(--page-bg);
    color: var(--text-primary);
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  .page { max-width: 100rem; margin: 0 auto; }
  h1 { font-size: 1.5rem; font-weight: 700; margin: 0 0 0.3rem; letter-spacing: -0.01em; }
  .subtitle { color: var(--text-secondary); margin: 0 0 1.5rem; font-size: 0.9rem; }

  .stat-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.9rem;
    margin-bottom: 1.75rem;
  }
  .stat-tile {
    background: var(--surface);
    border: 1px solid var(--hairline);
    border-radius: 12px;
    box-shadow: var(--shadow);
    padding: 0.9rem 1.25rem;
    min-width: 11rem;
  }
  .stat-tile .value {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1.15;
  }
  .stat-tile .label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: 0.15rem;
    font-size: 0.82rem;
    color: var(--text-secondary);
  }
  .stat-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--status-warning);
    flex: none;
  }

  .card {
    background: var(--surface);
    border: 1px solid var(--hairline);
    border-radius: 12px;
    box-shadow: var(--shadow);
    overflow: hidden;
  }
  .table-wrap { overflow-x: auto; }
  table {
    border-collapse: collapse;
    width: 100%;
    min-width: 36rem;
    font-size: 0.92rem;
  }
  caption {
    text-align: left;
    font-weight: 600;
    padding: 0.9rem 1rem 0.6rem;
    color: var(--text-primary);
  }
  th, td {
    border-bottom: 1px solid var(--gridline);
    padding: 0.65rem 1rem;
    text-align: left;
    vertical-align: top;
  }
  td.num { font-variant-numeric: tabular-nums; }
  thead th {
    background: var(--accent);
    color: var(--accent-fg);
    font-weight: 600;
    font-size: 0.82rem;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    position: sticky;
    top: 0;
    border-bottom: none;
  }
  tbody tr:hover { background: var(--accent-tint); }
  tbody tr:last-child td { border-bottom: none; }
  .empty-row td { text-align: center; color: var(--text-muted); font-style: italic; }

  .badge {
    display: inline-block;
    background: var(--accent-tint);
    color: var(--accent);
    border: 1px solid var(--hairline);
    border-radius: 999px;
    padding: 0.15rem 0.6rem;
    font-size: 0.8rem;
    font-weight: 600;
    white-space: nowrap;
  }

  section.review { margin-top: 2rem; }
  section.review .card {
    background: var(--page-bg);
    box-shadow: none;
  }
  section.review .note {
    margin: 0;
    padding: 0.75rem 1rem;
    font-size: 0.82rem;
    color: var(--text-secondary);
    border-bottom: 1px solid var(--gridline);
  }
  section.review caption { color: var(--text-secondary); font-size: 0.9rem; }
  section.review thead th {
    background: var(--accent-muted);
    color: var(--accent-fg);
    font-weight: 600;
    font-size: 0.82rem;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    border-bottom: none;
  }
  section.review td { color: var(--text-secondary); font-size: 0.88rem; }
  section.review table { min-width: 46rem; }
  section.review tbody tr:hover { background: rgba(11, 11, 11, 0.035); }
  section.review tbody tr:last-child td { border-bottom: none; }
  section.review .muted-inline { color: var(--text-muted); font-size: 0.8rem; }
  section.review .open-link {
    color: var(--accent);
    font-weight: 600;
    font-size: 0.82rem;
    text-decoration: none;
  }
  section.review .open-link:hover { text-decoration: underline; }

  .chip {
    display: inline-block;
    background: var(--surface);
    border: 1px solid var(--gridline);
    border-radius: 6px;
    padding: 0.1rem 0.45rem;
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 0.78rem;
    color: var(--text-secondary);
  }
  .status-badge {
    display: inline-block;
    background: #fdf1da;
    color: var(--status-warning-ink);
    border: 1px solid rgba(250, 178, 25, 0.4);
    border-radius: 999px;
    padding: 0.1rem 0.55rem;
    font-size: 0.74rem;
    font-weight: 600;
    margin-right: 0.4rem;
    white-space: nowrap;
  }
  .status-neutral, .status-scheduled {
    display: inline-block;
    border-radius: 999px;
    padding: 0.15rem 0.6rem;
    font-size: 0.8rem;
    font-weight: 600;
    white-space: nowrap;
  }
  .status-neutral {
    background: var(--gridline);
    color: var(--text-secondary);
  }
  .status-scheduled {
    background: var(--accent-tint);
    color: var(--accent);
    border: 1px solid var(--hairline);
  }

  footer {
    margin-top: 2.5rem;
    font-size: 0.78rem;
    color: var(--text-muted);
  }
</style>
</head>
<body>
  <div class="page">
    <h1>Welfare Loan Requests</h1>
    <p class="subtitle">Generated ${escapeHtml(generatedAt)} from local synthetic/redacted fixtures. Not connected to live Gmail.</p>

    <div class="stat-row">
      <div class="stat-tile">
        <div class="value">${valid.length}</div>
        <div class="label">Loan request${valid.length === 1 ? "" : "s"}</div>
      </div>
      <div class="stat-tile">
        <div class="value">${needsReview.length}</div>
        <div class="label"><span class="stat-dot" aria-hidden="true"></span>Awaiting internal review (not shown above)</div>
      </div>
      <div class="stat-tile">
        <div class="value">${statusNeedsReview.length}</div>
        <div class="label"><span class="stat-dot" aria-hidden="true"></span>Loan status needs manual review (shown above too)</div>
      </div>
    </div>

    <div class="card table-wrap">
      <table>
        <caption>Loan requests</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Requested By</th>
            <th scope="col">Amount</th>
            <th scope="col">Reason</th>
            <th scope="col">Loan Type</th>
            <th scope="col">Loan Status</th>
          </tr>
        </thead>
        <tbody>
${renderMainRows(valid)}
        </tbody>
      </table>
    </div>

    <section class="review">
      <div class="card">
        <p class="note">Internal review queue - two different situations land here, each fixed differently. "Open email" links assume you're signed into the relevant Gmail account as your primary browser account - if it opens the wrong inbox, switch accounts first.<br><br><strong>"Needs review"</strong> rows are incomplete/ambiguous requests not added to the table above - to resolve one after reading the original email, add its missing field(s) to <code class="chip">data/live/corrections.json</code> keyed by the id shown below (e.g. <code class="chip">{"&lt;id&gt;": {"loanType": "Personal", "correctedBy": "Your Name"}}</code>) and rerun the live pipeline.<br><br><strong>"Loan status review"</strong> rows are already complete requests (also shown in the table above) where staff's reply didn't use recognized scheduling wording - to resolve one, reply again in that email thread with <code class="chip">Scheduled for &lt;Month&gt;</code>; it's picked up automatically on the next run, with no file to edit.</p>
        <div class="table-wrap">
          <table>
            <caption>Review queue</caption>
            <thead>
              <tr>
                <th scope="col">Received / From / Subject</th>
                <th scope="col">Extracted so far</th>
                <th scope="col">Review note</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
${renderReviewRows(reviewQueue)}
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <footer>Local development build. Source: fixtures/emails - not a live Gmail connection.</footer>
  </div>
</body>
</html>
`;
}
