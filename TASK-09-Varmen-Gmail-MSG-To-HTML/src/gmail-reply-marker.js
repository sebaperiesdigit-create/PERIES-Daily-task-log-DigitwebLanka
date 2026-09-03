// Gmail's standard "On <date>, <sender> <email> wrote:" line, inserted right
// before quoted history in every reply. Shared by:
//   - src/parser.js    - strips quoted history before extracting fields
//   - src/config.js    - one of two signals used to detect "this is a reply,
//     not a fresh initial request" (see isQualifying)
//   - src/pipeline.js  - same signal, used to find reply-shaped candidates
//     for the gap-filling merge (see isReplyMessage below)
// Kept in its own tiny module so config.js doesn't need to import from
// parser.js (which itself imports from config.js) - avoids a circular import.
export const QUOTE_HISTORY_MARKER = /^On .+ wrote:\s*$/im;

/**
 * True if `email` looks like a reply/forward rather than a fresh, initial
 * message - either its subject carries the normal "Re:"/"Fwd:"/"Fw:" prefix,
 * or its body contains Gmail's quoted-history marker even without that
 * prefix (covers clients/compose flows that keep quoting without renaming
 * the subject).
 */
export function isReplyMessage(email) {
  const isReplySubject = /^\s*(re|fwd?|fw)\s*:/i.test(email.subject || "");
  const hasQuotedHistory = QUOTE_HISTORY_MARKER.test(email.bodyText || "");
  return isReplySubject || hasQuotedHistory;
}
