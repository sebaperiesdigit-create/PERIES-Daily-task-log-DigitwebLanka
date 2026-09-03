import { buildGmailClient } from "./gmail-client.js";
import { mapGmailMessage } from "./gmail-message-mapper.js";

// Stage 2 of the live rollout plan: read-only, manual fetch of qualifying
// messages from the live mailbox. Read-only scope only (gmail.readonly,
// already granted in Stage 1) - never sends, labels, or modifies anything.

// Mirrors config.js isQualifying (subject contains "loan" AND "request").
const QUALIFYING_QUERY = "subject:loan subject:request";

// Historical/backfill import is a SEPARATE, not-yet-implemented decision
// (see docs/README.md "Historical import" - a dedicated backfillMode flag is
// still needed before that's safe to turn on, since it must never draft or
// send acknowledgements for old requests). Without a recency bound, this
// fetch would read the mailbox's entire matching history in one call and
// effectively perform an unreviewed backfill. Default: last 30 days;
// override with GMAIL_FETCH_SINCE_DAYS if a different window is needed -
// this only limits what THIS fetch reads, it never changes the qualifying
// rule itself.
const DEFAULT_FETCH_SINCE_DAYS = 30;

function buildSearchQuery(now = new Date()) {
  const sinceDays = Number(process.env.GMAIL_FETCH_SINCE_DAYS) || DEFAULT_FETCH_SINCE_DAYS;
  const since = new Date(now.getTime() - sinceDays * 24 * 60 * 60 * 1000);
  const y = since.getFullYear();
  const m = String(since.getMonth() + 1).padStart(2, "0");
  const d = String(since.getDate()).padStart(2, "0");
  return `${QUALIFYING_QUERY} after:${y}/${m}/${d}`;
}

/**
 * Fetches and maps qualifying messages from the authenticated mailbox.
 * Read-only: only calls messages.list/messages.get, never anything that
 * sends, labels, or modifies. Returns email objects in the same shape
 * parseEmail() already consumes.
 */
export async function fetchQualifyingEmails({ maxResults = 50, now } = {}) {
  const gmail = buildGmailClient();
  const query = buildSearchQuery(now);

  const listResp = await gmail.users.messages.list({ userId: "me", q: query, maxResults });
  const messageRefs = listResp.data.messages ?? [];

  const emails = [];
  for (const { id } of messageRefs) {
    const msg = await gmail.users.messages.get({ userId: "me", id, format: "full" });
    emails.push(mapGmailMessage(msg.data));
  }
  return emails;
}
