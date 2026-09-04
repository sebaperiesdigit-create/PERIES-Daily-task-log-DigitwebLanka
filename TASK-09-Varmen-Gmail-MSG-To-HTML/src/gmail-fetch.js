import { buildGmailClient } from "./gmail-client.js";
import { mapGmailMessage } from "./gmail-message-mapper.js";

// Stage 2 of the live rollout plan: read-only, manual fetch of qualifying
// messages from the live mailbox. Read-only scope only (gmail.readonly,
// already granted in Stage 1) - never sends, labels, or modifies anything.

// Mirrors config.js isQualifying (subject contains "loan" AND "request").
const QUALIFYING_QUERY = "subject:loan subject:request";

// Historical/backfill import: a dedicated backfillMode flag in
// src/pipeline.js already ensures old requests never get drafted/sent
// acknowledgements (see src/run-live.js). Default fetch window: last 30
// days; override with GMAIL_FETCH_SINCE_DAYS if a different window is
// needed - this only limits what THIS fetch reads, it never changes the
// qualifying rule itself.
const DEFAULT_FETCH_SINCE_DAYS = 30;

// 2026-09-04: real evidence - the user found multiple genuine loan
// requests, several months old, silently missing from every run, because
// they fell outside the default 30-day window. GMAIL_FETCH_SINCE_DAYS set
// to the literal string "all" (not a number) skips the `after:` clause
// entirely - fetches the FULL mailbox history matching the qualifying
// subject rule, no date bound. Intended for a one-time historical
// catch-up, combined with FORCE_BACKFILL=true in src/run-live.js so it
// never drafts acknowledgements for old, likely-already-resolved requests.
export function buildSearchQuery(now = new Date()) {
  const raw = process.env.GMAIL_FETCH_SINCE_DAYS;
  if (raw === "all") return QUALIFYING_QUERY;

  const sinceDays = Number(raw) || DEFAULT_FETCH_SINCE_DAYS;
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
 *
 * FIX 2026-09-04: previously capped at the first `maxResults` (50) results
 * with no pagination - silently dropped anything beyond that with no
 * warning. Now pages through every result via `nextPageToken`, up to
 * `maxTotal` (a logged safety ceiling, not a silent truncation point).
 */
export async function fetchQualifyingEmails({ maxResults = 50, maxTotal = 2000, now } = {}) {
  const gmail = buildGmailClient();
  const query = buildSearchQuery(now);

  const messageRefs = [];
  let pageToken;
  do {
    const listResp = await gmail.users.messages.list({ userId: "me", q: query, maxResults, pageToken });
    messageRefs.push(...(listResp.data.messages ?? []));
    pageToken = listResp.data.nextPageToken;
  } while (pageToken && messageRefs.length < maxTotal);

  if (pageToken) {
    console.warn(
      `fetchQualifyingEmails: hit the ${maxTotal}-message safety ceiling - some matching mail may not have been fetched.`
    );
  }

  const emails = [];
  for (const { id } of messageRefs) {
    const msg = await gmail.users.messages.get({ userId: "me", id, format: "full" });
    emails.push(mapGmailMessage(msg.data));
  }
  return emails;
}
