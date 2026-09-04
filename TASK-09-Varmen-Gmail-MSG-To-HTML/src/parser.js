import { PARSER_VERSION } from "./config.js";
import { QUOTE_HISTORY_MARKER } from "./gmail-reply-marker.js";

// "Date" is CONFIRMED (2026-09-03) to mean the Gmail received timestamp, not
// anything written in the body - so it's derived directly from the email, not
// extracted/required like the other 4 fields. See config.js "Date semantics".
const REQUIRED_BODY_FIELDS = ["requestedBy", "amount", "reason", "loanType"];

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Discards Gmail's quoted reply history so extraction only sees the sender's own new text. */
function stripQuotedHistory(bodyText) {
  // Defense-in-depth: config.js's isQualifying already excludes messages with
  // this same marker (they're replies, not fresh requests), so in normal
  // operation this rarely has anything to strip. Kept as a second layer in
  // case a message reaches here with quoted content some other way.
  if (!bodyText) return "";
  const match = QUOTE_HISTORY_MARKER.exec(bodyText);
  return match ? bodyText.slice(0, match.index) : bodyText;
}

/**
 * Joins hard line-wraps back into single lines within each paragraph, while
 * preserving genuine paragraph breaks (a blank line). FIX 2026-09-03: real
 * emails are typically wrapped at ~78 characters mid-sentence (e.g. "...due to an\r\nurgent
 * personal matter."), which broke reason/correction-phrase extraction - those
 * used `[^\r\n]` to mean "stop at a sentence/paragraph end", but a hard wrap
 * isn't actually a sentence end. Must run AFTER stripQuotedHistory (which
 * needs the original line structure to find the "On ... wrote:" marker).
 */
function unwrapHardLineWraps(text) {
  if (!text) return "";
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/) // paragraphs, separated by a blank line
    .map((paragraph) => paragraph.replace(/\n/g, " ").replace(/[ \t]+/g, " ").trim())
    .join("\n\n");
}

/** Derives the calendar date (YYYY-MM-DD) from a Gmail-style receivedAt timestamp. */
function deriveDate(receivedAt) {
  if (!receivedAt) return null;
  // Take the date portion as written (before "T"), rather than re-parsing
  // through Date/UTC, so the timezone offset already embedded in the
  // timestamp can't shift the calendar day.
  const [datePart] = String(receivedAt).split("T");
  return datePart || null;
}

/** Finds every match of `pattern` in `text`, forcing the global flag on. */
function findAllMatches(text, pattern) {
  const flags = pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g";
  return [...text.matchAll(new RegExp(pattern.source, flags))];
}

/** "100000" -> "100,000" - comma-grouped digits, no other formatting. */
function addThousandsCommas(digits) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Currency-prefixed pattern first (exactly one distinct match required);
 * falls back to a narrowly-anchored bare number (also exactly one distinct
 * match, within a realistic digit-length range). Any ambiguity - zero matches,
 * multiple different amounts, or an out-of-range bare number - returns null
 * rather than guessing which value is correct.
 *
 * v9 (2026-09-04): a bare-number match (no currency prefix in the original
 * text) is now normalized to "LKR <comma-grouped digits>" rather than
 * stored as raw digits - e.g. "100000" -> "LKR 100,000". A currency-
 * prefixed match is stored exactly as captured, unchanged.
 */
function extractAmount(newText, config) {
  const [currencyPattern, bareNumberPattern] = config.amountPatterns;

  const currencyMatches = findAllMatches(newText, currencyPattern).map((m) => m[0].trim());
  const uniqueCurrency = [...new Set(currencyMatches)];
  if (uniqueCurrency.length === 1) return uniqueCurrency[0];
  if (uniqueCurrency.length > 1) return null; // multiple plausible amounts

  const { min, max } = config.amountBareNumberDigitRange;
  const bareMatches = findAllMatches(newText, bareNumberPattern)
    .map((m) => m[1])
    .filter((digits) => {
      const len = digits.replace(/[^\d]/g, "").length;
      return len >= min && len <= max;
    });
  const uniqueBare = [...new Set(bareMatches)];
  if (uniqueBare.length === 1) return `LKR ${addThousandsCommas(uniqueBare[0].replace(/,/g, ""))}`;

  return null;
}

/** Subject-only: a bare word match is fine here (subjects are short and deliberate, e.g. "Personal Loan Request"). */
export function scanLoanTypeKeywords(text, config) {
  const lower = (text || "").toLowerCase();
  for (const [keyword, label] of config.loanTypeKeywords) {
    if (lower.includes(keyword)) return label;
  }
  return null;
}

/**
 * Body/staff-reply text: DELIBERATELY stricter than scanLoanTypeKeywords -
 * requires "<type> loan" (e.g. "medical loan"), not a bare word. See
 * config.js loanTypeBodyPhrases: a bare-word body scan real-bug-matched
 * "welfare" inside every email's own "Dear Welfare Team," greeting.
 */
function scanLoanTypeBodyPhrases(text, config) {
  const lower = (text || "").toLowerCase();
  for (const [phrase, label] of config.loanTypeBodyPhrases ?? []) {
    if (lower.includes(phrase)) return label;
  }
  return null;
}

/** Infers a Loan Type from the Reason text alone - last resort before defaulting. See config.js loanTypeReasonKeywords. */
function inferLoanTypeFromReason(reason, config) {
  if (!reason) return null;
  const lower = reason.toLowerCase();
  for (const [keywords, label] of config.loanTypeReasonKeywords ?? []) {
    if (keywords.some((kw) => lower.includes(kw))) return label;
  }
  return null;
}

const GENERIC_LOAN_TYPE = "Personal";

/**
 * Resolves Loan Type from the requester's OWN subject + body + reason only
 * - CONFIRMED 2026-09-04 (grill-me session), reverses the earlier "never
 * guess, leave blank" rule for this one field. See PARSER_VERSION v9 notes
 * in config.js for the full rationale.
 *
 * REVISED after a real regression was caught in testing: an EXPLICIT
 * statement (subject keyword match, OR a body "<type> loan" phrase) is
 * ALWAYS authoritative and final - including an explicit "Personal" -
 * never second-guessed by reason-inference. The original design treated
 * "Personal" as a weak/generic default even when explicitly, deliberately
 * stated (e.g. subject "Personal Loan Request" AND body "a personal loan
 * of..."), which let a merely-circumstantial reason ("...due to urgent
 * medical expenses") silently override two explicit statements to
 * "Medical" - wrong. Reason-inference and the "Personal" default now ONLY
 * apply when NEITHER subject NOR body gives any explicit signal at all.
 *
 * Priority: subject match (any) -> body phrase match (any) ->
 * reason-inference -> default "Personal" (no signal anywhere). A
 * subject/body disagreement (each explicitly naming a different type) still
 * keeps the subject's value but is flagged via `discrepancyNote` rather
 * than silently dropped - informational only, never overrides.
 *
 * Does NOT consider staff-reply text - a single email's own extraction has
 * no visibility into other messages in the thread. See
 * `applyStaffConfirmationDetails` in src/pipeline.js for the thread-level
 * staff-reply upgrade step that runs after this (which itself only
 * upgrades a "default_no_signal"-sourced "Personal", never an explicit one).
 */
function resolveOwnLoanType({ subject, bodyText, reason, config }) {
  const subjectType = scanLoanTypeKeywords(subject, config);
  const bodyType = scanLoanTypeBodyPhrases(bodyText, config);

  if (subjectType) {
    const discrepancyNote =
      bodyType && bodyType !== subjectType
        ? `Body text suggests loan type "${bodyType}" but the subject explicitly says "${subjectType}" - kept the subject's value.`
        : null;
    return { loanType: subjectType, loanTypeSource: "subject", discrepancyNote };
  }
  if (bodyType) {
    return { loanType: bodyType, loanTypeSource: "body", discrepancyNote: null };
  }

  const reasonType = inferLoanTypeFromReason(reason, config);
  if (reasonType) {
    return { loanType: reasonType, loanTypeSource: "reason_inference", discrepancyNote: null };
  }

  return { loanType: GENERIC_LOAN_TYPE, loanTypeSource: "default_no_signal", discrepancyNote: null };
}

/**
 * Only captures text right after an approved trigger phrase - never inferred
 * from surrounding prose. v9 (2026-09-04): result is cosmetically formatted
 * before returning - first letter capitalized, a trailing period added if
 * missing. Extraction boundaries (WHAT gets captured) are unchanged.
 */
function extractReason(newText, config) {
  const raw = extractRawReason(newText, config);
  return raw ? formatReasonText(raw) : null;
}

function extractRawReason(newText, config) {
  for (const phrase of config.reasonTriggerPhrases) {
    const re = new RegExp(`${escapeRegExp(phrase)}\\s+([^.\\r\\n!?]+)`, "i");
    const match = re.exec(newText);
    if (match) {
      const value = match[1].trim();
      if (value.length > 0) return value;
    }
  }
  // Distinct fallback shape: "for personal reasons" etc - see config.js
  // reasonReasonWordPattern for why this can't just be another trigger phrase.
  if (config.reasonReasonWordPattern) {
    const match = config.reasonReasonWordPattern.exec(newText);
    if (match) {
      const value = match[1].trim();
      if (value.length > 0) return value;
    }
  }
  return null;
}

function formatReasonText(reason) {
  const capitalized = reason.charAt(0).toUpperCase() + reason.slice(1);
  return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;
}

/**
 * Cleans a raw extracted name (from a signature or a From header) without
 * inventing anything: strips markdown-style emphasis characters some
 * signatures use (e.g. "*M. Renuha*" -> "M. Renuha"), and strips any
 * configured organizational suffix that isn't actually part of a person's
 * name - it's just how this org's Gmail accounts happen to be labeled (e.g.
 * "sajeepan digitweblanka" -> "sajeepan"). Never adds/guesses a name.
 */
function cleanExtractedName(name, config) {
  if (!name) return name;
  let cleaned = name
    .replace(/[*_]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  for (const suffix of config.nameOrganizationSuffixes ?? []) {
    const re = new RegExp(`\\b${escapeRegExp(suffix)}\\b`, "gi");
    cleaned = cleaned.replace(re, "").replace(/\s+/g, " ").trim();
  }
  return cleaned;
}

/**
 * Real inbox evidence (2026-09-04): a sign-off is often just a first name
 * ("Kind regards, Sajeepan") while this org's Gmail accounts are labeled
 * "<firstname> digitweblanka" - but occasionally the From header's display
 * name carries a real surname the sign-off doesn't (e.g. sign-off
 * "M.Manoranjani" vs header "manoranjani maheswaran"). Picking sign-off
 * unconditionally silently dropped that surname. Fixed: extract both
 * candidates and keep whichever has MORE name parts (a strict proxy for
 * "fuller name"); ties keep the sign-off, since it's the requester's own
 * words about their own name.
 */
function extractRequestedBy(newText, fromHeader, config) {
  const alternation = config.signOffPhrases.map(escapeRegExp).join("|");
  // Generic \s+ (not specifically \r?\n+): after unwrapping hard line-wraps,
  // a sign-off and name may now be space-separated on one line ("Kind
  // regards, Someone") rather than always on two lines - \s+ matches both
  // that and a genuine paragraph break (still present as \n\n).
  const signOffRe = new RegExp(`(?:${alternation})[,:.]?\\s+([^\\r\\n]+)`, "i");
  const match = signOffRe.exec(newText);
  let signOffName = null;
  if (match) {
    const name = cleanExtractedName(match[1].trim(), config);
    if (name.length > 0 && name.length < 80) signOffName = name;
  }

  let headerName = null;
  if (fromHeader) {
    const displayName = cleanExtractedName(fromHeader.split("<")[0].trim(), config);
    if (displayName.length > 0) headerName = displayName;
  }

  if (signOffName && headerName) {
    return namePartCount(headerName) > namePartCount(signOffName) ? headerName : signOffName;
  }
  return signOffName ?? headerName ?? null;
}

/** Exported so src/pipeline.js can compare a staff-reply-stated name against the current value too. */
export function namePartCount(name) {
  return name ? name.split(/\s+/).filter(Boolean).length : 0;
}

/** True if the sender's new text contains any configured correction/follow-up signal phrase. */
function hasCorrectionSignal(newText, config) {
  const lower = newText.toLowerCase();
  return config.correctionSafeguardPhrases.some((phrase) => lower.includes(phrase.toLowerCase()));
}

/**
 * Reads a loan-status signal from a STAFF reply's own text (quoted history
 * stripped, hard-wraps unwrapped - same treatment as the 4 business fields).
 * CONFIRMED 2026-09-03: only called on messages already verified to be from
 * the configured staff address (config.statusStaffAddress), within the
 * relevant thread - see src/pipeline.js `detectLoanStatus`. This is a
 * deliberately different trust model from field extraction: staff genuinely
 * are the authority for approval/scheduling status, unlike the 4 business
 * fields, which only ever come from the requester's own words.
 *
 * Minimal, evidence-based vocabulary - a staff reply whose wording doesn't
 * match the one recognized real-world pattern is surfaced as "Needs manual
 * review" rather than guessed at.
 */
export function extractStatusFromStaffReply(staffEmail, config) {
  const newText = unwrapHardLineWraps(stripQuotedHistory(staffEmail.bodyText));
  const match = config.statusScheduledPattern.exec(newText);
  if (match) {
    return `Scheduled for ${match[1]}`;
  }
  return "Needs manual review";
}

/**
 * BEST-EFFORT heuristic (2026-09-04) - tries "Dear <Name>," first (staff
 * replies are addressed TO the requester, so this greeting is expected to
 * name them), falling back to the first capitalized 2+-word phrase that
 * isn't a known non-name word. See config.js staffNameGreetingPattern/
 * staffNameExcludedWords for why this is provisional: unlike the
 * requester-side name patterns, there's no real calibration data for how
 * staff actually phrase a confirmation reply.
 */
function extractStaffStatedName(newText, config) {
  const greetingMatch = config.staffNameGreetingPattern.exec(newText);
  if (greetingMatch) {
    const name = cleanExtractedName(greetingMatch[1].trim(), config);
    if (name.length > 0 && name.length < 80) return name;
  }

  const excluded = new Set((config.staffNameExcludedWords ?? []).map((w) => w.toLowerCase()));
  const candidateRe = /\b([A-Z][a-zA-Z.]{1,20}(?:\s+[A-Z][a-zA-Z.]{1,20}){1,3})\b/g;
  for (const m of newText.matchAll(candidateRe)) {
    const phrase = m[1].trim();
    const firstWord = phrase.split(/\s+/)[0].toLowerCase();
    if (excluded.has(firstWord)) continue;
    const cleaned = cleanExtractedName(phrase, config);
    if (cleaned.length > 0) return cleaned;
  }
  return null;
}

/**
 * Extracts whatever business-field-like CANDIDATES can be found in a STAFF
 * reply's own text (quoted history stripped, hard-wraps unwrapped - same
 * treatment as the requester's own email). CONFIRMED 2026-09-04 (grill-me
 * session) as the third gap-filling data source, alongside the same-sender
 * gap-fill merge and manual corrections. This function only extracts
 * candidates - it does NOT decide whether/how to apply them; see
 * `applyStaffConfirmationDetails` in src/pipeline.js for the precedence
 * rules (fill-only for Amount/Reason, fullest-name-wins for Requested By,
 * generic-Personal-upgrade-only for Loan Type).
 *
 * Reuses the exact same Amount/Reason patterns as the requester-side
 * extraction (staff restating "LKR 100,000" or "due to medical expenses"
 * looks the same either way) - only the name heuristic and loan-type scan
 * differ, since staff replies don't have their own meaningfully-different
 * "subject" (Gmail keeps the original "Re: <subject>").
 */
export function extractStaffConfirmationDetails(staffEmail, config) {
  const newText = unwrapHardLineWraps(stripQuotedHistory(staffEmail.bodyText));
  return {
    requestedBy: extractStaffStatedName(newText, config),
    amount: extractAmount(newText, config),
    reason: extractReason(newText, config),
    loanType: scanLoanTypeBodyPhrases(newText, config),
  };
}

/**
 * Extracts the 4 business fields from an email, WITHOUT the qualifying gate -
 * pure extraction, usable on any email shape (including a reply that
 * config.isQualifying would exclude from becoming its own record). Used by
 * parseEmail() below, and by src/pipeline.js's gap-filling merge, which runs
 * this on a reply candidate to see whether it supplies a field the matching
 * needs_review original is missing.
 */
export function extractFields(email, config) {
  const newText = unwrapHardLineWraps(stripQuotedHistory(email.bodyText));
  const reason = extractReason(newText, config);
  const { loanType, loanTypeSource, discrepancyNote } = resolveOwnLoanType({
    subject: email.subject,
    bodyText: newText,
    reason,
    config,
  });
  return {
    requestedBy: extractRequestedBy(newText, email.from, config),
    amount: extractAmount(newText, config),
    reason,
    loanType,
    loanTypeSource,
    discrepancyNote,
  };
}

/**
 * Parses one raw (Gmail-shaped) email into an internal loan-request record.
 *
 * Returns `null` when the email does not qualify at all (per config.isQualifying) -
 * unrelated mail is never silently parsed or stored.
 *
 * Otherwise always returns a record. Missing/ambiguous required fields never get
 * invented; the record is marked parseStatus "needs_review" instead of "ok".
 * A message that looks like a correction/follow-up (per config.correctionSafeguardPhrases)
 * is always forced to "needs_review" too, even if all 4 fields extracted cleanly -
 * correction/cancellation handling is manual-review-only in this delivery.
 */
export function parseEmail(email, config) {
  if (!config.isQualifying(email)) {
    return null;
  }

  const newText = unwrapHardLineWraps(stripQuotedHistory(email.bodyText));
  const date = deriveDate(email.receivedAt);

  const extracted = extractFields(email, config);

  const missing = REQUIRED_BODY_FIELDS.filter((field) => extracted[field] === null);
  // A missing receivedAt shouldn't happen for a real Gmail message, but if it
  // ever does, never invent a date - send the record to review instead.
  if (date === null) missing.push("date (missing receivedAt)");

  let parseStatus = missing.length === 0 ? "ok" : "needs_review";
  let reviewNotes = missing.length > 0 ? `Missing/ambiguous field(s): ${missing.join(", ")}` : null;

  if (hasCorrectionSignal(newText, config)) {
    parseStatus = "needs_review";
    const correctionNote = "possible correction or follow-up; manual review required";
    reviewNotes = reviewNotes ? `${reviewNotes}; ${correctionNote}` : correctionNote;
  }

  return {
    sourceId: email.id,
    // Private/internal only - never rendered in the 5-column staff table.
    // threadId/fromAddress/subject are needed to address a thread-linked
    // acknowledgement draft; see src/acknowledgement.js.
    threadId: email.threadId ?? null,
    fromAddress: email.from ?? null,
    subject: email.subject ?? null,
    receivedAt: email.receivedAt ?? null,
    parserVersion: PARSER_VERSION,
    parseStatus,
    reviewNotes,
    date,
    requestedBy: extracted.requestedBy,
    amount: extracted.amount,
    loanTypeSource: extracted.loanTypeSource,
    discrepancyNote: extracted.discrepancyNote,
    reason: extracted.reason,
    loanType: extracted.loanType,
  };
}
