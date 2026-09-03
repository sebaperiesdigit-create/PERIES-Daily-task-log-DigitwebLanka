import fs from "node:fs";
import path from "node:path";

import { config, subjectHasQualifyingKeywords, PARSER_VERSION } from "./config.js";
import { parseEmail, extractFields, extractStatusFromStaffReply } from "./parser.js";
import { isReplyMessage } from "./gmail-reply-marker.js";
import { Store } from "./store.js";
import { renderHtml } from "./html.js";
import { prepareAcknowledgementIfNeeded } from "./acknowledgement.js";

const BUSINESS_FIELDS = ["requestedBy", "amount", "reason", "loanType"];

/** Reads every *.json fixture email from a directory, sorted by filename for determinism. */
export function loadFixtureEmails(fixturesDir) {
  const files = fs
    .readdirSync(fixturesDir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  return files.map((file) => {
    const raw = fs.readFileSync(path.join(fixturesDir, file), "utf8");
    return JSON.parse(raw);
  });
}

/** Copies only the private ack_* tracking fields from a previously-stored record. */
function pickAckFields(storedRecord) {
  const ackFields = {};
  if (!storedRecord) return ackFields;
  for (const key of Object.keys(storedRecord)) {
    if (key.startsWith("ack_")) ackFields[key] = storedRecord[key];
  }
  return ackFields;
}

/**
 * Gap-filling merge (CONFIRMED 2026-09-03, narrowly scoped - see docs/README.md
 * and config.js PARSER_VERSION v6 notes for the full rationale).
 *
 * A reply is normally excluded entirely by config.isQualifying (it's treated
 * as ordinary back-and-forth, never becomes its own record). This function
 * looks at exactly those excluded replies and asks one narrow question: does
 * this reply supply a field that's genuinely MISSING on a needs_review record
 * from the SAME sender in the SAME thread? If so, that one field is filled in
 * - nothing else changes.
 *
 * Three hard boundaries, enforced here:
 *   1. Only fills a field that is currently null - never overwrites a value
 *      that was already successfully extracted.
 *   2. Only ever touches a record whose parseStatus is "needs_review" -
 *      an already-"ok" record is never revisited.
 *   3. Only merges from the exact same sender (From header) in the exact
 *      same Gmail thread - a reply from anyone else (e.g. staff) is ignored.
 *
 * `needsReviewByThreadId` should contain BOTH this run's freshly-parsed
 * needs_review records AND any needs_review records already in the store
 * from a previous run (so a correction that arrives in a later run, after
 * its original aged out of the fetch window, still gets applied).
 *
 * Returns { updatedByThreadId: Map<threadId, record> } - only entries that
 * actually changed.
 */
function mergeGapFillingReplies({ emails, needsReviewByThreadId, config }) {
  const replyCandidates = emails
    .filter((email) => subjectHasQualifyingKeywords(email.subject) && isReplyMessage(email))
    .sort((a, b) => String(a.receivedAt ?? "").localeCompare(String(b.receivedAt ?? "")));

  const updatedByThreadId = new Map();

  for (const replyEmail of replyCandidates) {
    const current = updatedByThreadId.get(replyEmail.threadId) ?? needsReviewByThreadId.get(replyEmail.threadId);
    if (!current || current.parseStatus !== "needs_review") continue; // boundary 2
    if (current.fromAddress !== replyEmail.from) continue; // boundary 3

    const replyFields = extractFields(replyEmail, config);
    let changed = false;
    const filled = { ...current };
    for (const field of BUSINESS_FIELDS) {
      if (filled[field] === null && replyFields[field] !== null) {
        // boundary 1: only ever fills a currently-null field
        filled[field] = replyFields[field];
        changed = true;
      }
    }
    if (!changed) continue;

    const stillMissing = BUSINESS_FIELDS.filter((field) => filled[field] === null);
    filled.parseStatus = stillMissing.length === 0 ? "ok" : "needs_review";
    filled.reviewNotes = stillMissing.length > 0 ? `Missing/ambiguous field(s): ${stillMissing.join(", ")}` : null;
    filled.parserVersion = PARSER_VERSION;
    filled.gapFilledFromMessageId = replyEmail.id;
    filled.gapFilledAt = new Date().toISOString();

    updatedByThreadId.set(replyEmail.threadId, filled);
  }

  return updatedByThreadId;
}

/**
 * True if a raw "From" header contains the given address. A real Gmail
 * "From" header is "Display Name <address>", not the bare address (FIX
 * 2026-09-03: found via real Stage 2 output showing "Submitted" for threads
 * that clearly had a staff reply - the exact-match comparison against the
 * bare configured address never matched "Digitweb Lanka Welfare society
 * <welfaredw@gmail.com>").
 */
function fromHeaderMatchesAddress(fromHeader, address) {
  return (fromHeader ?? "").toLowerCase().includes(address.toLowerCase());
}

/**
 * Loan status detection (v7, CONFIRMED 2026-09-03 - see config.js
 * statusStaffAddress/statusScheduledPattern for the full rationale).
 *
 * Only ever called for "ok" records. Looks for a reply in the SAME thread
 * sent by the configured staff address; if found, reads a status from that
 * reply's own text (the most recent staff reply wins, if there's more than
 * one). Falls back to a previously-detected status (carried forward, like
 * ack_* fields) if this run's fetch doesn't include a staff reply for that
 * thread - so status is never lost just because it aged out of the fetch
 * window. Defaults to "Submitted" when no staff reply has ever been seen.
 */
function detectLoanStatus({ emails, record, previouslyStored, config }) {
  const staffReplies = emails
    .filter(
      (email) => email.threadId === record.threadId && fromHeaderMatchesAddress(email.from, config.statusStaffAddress)
    )
    .sort((a, b) => String(b.receivedAt ?? "").localeCompare(String(a.receivedAt ?? ""))); // most recent first

  if (staffReplies.length > 0) {
    return extractStatusFromStaffReply(staffReplies[0], config);
  }

  const previousStatus = previouslyStored[record.sourceId]?.status;
  if (previousStatus) return previousStatus;

  return "Submitted";
}

/**
 * Runs the full local pipeline: emails -> parse -> ack draft (if newly due) ->
 * store (idempotent upsert) -> standalone HTML. Never sends anything, never
 * touches Varmen DB - purely local files.
 *
 * Email source: pass `emails` directly (e.g. from src/gmail-fetch.js) to skip
 * loading fixtures - used by the Stage 2 live pipeline. When `emails` is
 * omitted, falls back to loading *.json fixtures from `fixturesDir`, unchanged
 * from the demo/test pipeline's original behavior. This function itself never
 * imports or calls anything Gmail-specific - it's the caller's job to supply
 * `emails` already in the right shape.
 *
 * `backfillMode` (default false): when true, acknowledgement drafting is
 * skipped ENTIRELY, for every record, regardless of parseStatus. A historical
 * import (the first time real mail is fetched, before any "last seen"
 * baseline exists) must never draft acknowledgements for old, likely
 * already-resolved requests - see src/run-live.js for how this is decided
 * automatically (first-ever run = backfill).
 *
 * Gap-filling merge (v6, see mergeGapFillingReplies above): after parsing,
 * a reply that was excluded from becoming its own record is checked against
 * needs_review records (this run's, and any already in the store) for a
 * same-sender, same-thread field it can fill. Only ever completes a gap;
 * never touches an already-"ok" record. If that merge completes a record
 * (all 4 fields now present), it becomes eligible for an acknowledgement
 * draft the same as any other newly-"ok" record (still subject to
 * backfillMode above).
 */
export function runPipeline({
  fixturesDir,
  emails: providedEmails,
  storePath,
  outputHtmlPath,
  ackDir,
  now,
  backfillMode = false,
}) {
  const emails = providedEmails ?? loadFixtureEmails(fixturesDir);
  const store = new Store(storePath);
  const previouslyStored = store.load(); // keyed by sourceId; carries prior ack_* state

  const parsed = [];
  for (const email of emails) {
    const record = parseEmail(email, config);
    if (record === null) continue; // ineligible: not stored, not shown, never acked

    // parseEmail always re-derives fresh business/parse fields from the fixture;
    // carry forward any ack_* fields a prior run already set, so idempotency
    // survives across reruns even though the rest of the record is recomputed.
    const withPriorAckState = { ...record, ...pickAckFields(previouslyStored[record.sourceId]) };
    parsed.push(withPriorAckState);
  }

  // needs_review records eligible for gap-filling, keyed by threadId: this
  // run's freshly-parsed ones take priority over a stale previously-stored
  // version of the same thread (built in that order so later .set() wins).
  const needsReviewByThreadId = new Map();
  for (const record of Object.values(previouslyStored)) {
    if (record.parseStatus === "needs_review") needsReviewByThreadId.set(record.threadId, record);
  }
  for (const record of parsed) {
    if (record.parseStatus === "needs_review") needsReviewByThreadId.set(record.threadId, record);
  }

  const mergeUpdates = mergeGapFillingReplies({ emails, needsReviewByThreadId, config });
  for (const [, updated] of mergeUpdates) {
    const idx = parsed.findIndex((r) => r.sourceId === updated.sourceId);
    if (idx >= 0) {
      parsed[idx] = updated;
    } else {
      // The original only existed in a previous run's store (e.g. it aged out
      // of this run's fetch window) - still apply the update.
      parsed.push({ ...updated, ...pickAckFields(previouslyStored[updated.sourceId]) });
    }
  }

  // v7: attach the "Status" 6th column - only meaningful for "ok" records,
  // since needs_review ones aren't in the main table at all.
  const withStatus = parsed.map((record) => {
    if (record.parseStatus !== "ok") return record;
    return { ...record, status: detectLoanStatus({ emails, record, previouslyStored, config }) };
  });

  const withAcks =
    ackDir && !backfillMode
      ? withStatus.map((record) => prepareAcknowledgementIfNeeded({ record, config, ackDir, now }))
      : withStatus;

  store.upsertAll(withAcks);
  const allRecords = store.list();

  const html = renderHtml(allRecords, { generatedAt: (now ?? new Date()).toISOString() });

  if (outputHtmlPath) {
    fs.mkdirSync(path.dirname(outputHtmlPath), { recursive: true });
    fs.writeFileSync(outputHtmlPath, html, "utf8");
  }

  return { emails, parsed: withAcks, allRecords, html };
}
