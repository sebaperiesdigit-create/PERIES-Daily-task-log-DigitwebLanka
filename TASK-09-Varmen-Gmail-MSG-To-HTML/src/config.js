// Central, editable configuration for the loan-request extraction pipeline.
//
// Everything in this file is a SAFE ASSUMPTION made for the first delivery, not a
// confirmed business rule. See docs/README.md "Known unknowns" before pointing this
// at anything beyond the local fixtures in fixtures/emails/.

import { isReplyMessage } from "./gmail-reply-marker.js";

// v3 (2026-09-03): fixed by real Stage 2 live-run evidence (18 real messages).
// v2 treated every reply in a thread as its own candidate loan request, which
// - since Gmail keeps "Re: <subject>" on every reply - massively inflated
// needs_review (most replies don't restate the amount/reason/type) and caused
// the acknowledgement-draft/backfill bug below. v3 only qualifies a message
// that looks like a genuinely fresh, initial request.
// v4 (2026-09-03): fixed by inspecting real Stage 2 output ("Reason" showing
// just "an"). Real emails are hard line-wrapped at ~78 chars mid-sentence -
// src/parser.js now joins wrapped lines back together (preserving real
// paragraph breaks) before extracting reason/requestedBy/correction-phrases,
// which previously stopped at every line break as if it were a sentence end.
// v5 (2026-09-03): fixed by inspecting real "Requested By" values. One
// signature used markdown-style emphasis ("*M. Renuha*") and the literal
// asterisks leaked into the stored name; this org's Gmail accounts are also
// labeled "firstname digitweblanka", which isn't a real name component.
// v6 (2026-09-03): two fixes from real evidence the user brought back after
// opening actual flagged emails via the new "Open email" link:
//   - reason patterns were too narrow ("for personal reasons" and "to
//     support my current financial requirements" weren't recognized at all)
//   - a same-sender, same-thread follow-up that corrects a genuinely missing
//     field (e.g. "I would also like to request a loan of 100000 - apologies
//     for missing the amount") was being discarded entirely by the v3
//     reply-exclusion rule, even though it's not staff negotiation - it's the
//     same person completing their own request minutes later. See
//     src/pipeline.js `mergeGapFillingReplies` for the narrowly-scoped fix:
//     fills ONLY missing fields, ONLY from the same sender in the same
//     thread, NEVER touches an already-"ok" record.
// v7 (2026-09-03): adds a 6th column, "Status" - the user pointed out that
// even a fully-extracted "ok" request gives no indication of what happened
// to it afterward (staff often reply "scheduled for <Month>"). Formally
// revises the "exactly 5 columns" requirement. See statusStaffAddress /
// statusScheduledPattern below and src/pipeline.js `detectLoanStatus`.
export const PARSER_VERSION = "v7";

// Exported separately from `isQualifying` so src/pipeline.js can reuse the
// exact same "does this subject even look loan-related" check when deciding
// whether an excluded reply is a candidate for the gap-filling merge (a
// reply to a completely unrelated thread must never become a merge candidate
// just because it happens to be a reply).
export function subjectHasQualifyingKeywords(subject) {
  const lower = (subject || "").toLowerCase();
  return lower.includes("loan") && lower.includes("request");
}

export const config = {
  // --- Qualifying rule - REVISED 2026-09-03 after the first real Stage 2 run ---
  // Rule (unchanged core, CONFIRMED 2026-09-03 against 5 real subject lines):
  // the subject contains BOTH "loan" and "request" (case-insensitive, either
  // order). NEW as of this revision: a message that looks like a reply is
  // EXCLUDED entirely (treated like any other non-matching mail - never
  // stored, never shown, never reviewed), not just deprioritized. A message
  // is treated as a reply if EITHER:
  //   - its subject starts with "Re:"/"Fwd:"/"Fw:" (a mail client's normal
  //     reply/forward prefix), OR
  //   - its body contains Gmail's quoted-history marker ("On ... wrote:"),
  //     even if the subject happens to lack a "Re:" prefix.
  // Why: the real Stage 2 run showed most subject-matching mail is actually
  // an ongoing back-and-forth (staff explaining a one-loan-per-month queue,
  // member confirming) - replies essentially never restate the amount/reason/
  // type on their own, so they correctly failed the strict parser, but they
  // shouldn't have been treated as candidate loan requests in the first place.
  // A vague/incomplete INITIAL request still goes to needs_review as before -
  // this change only removes replies from consideration, it does not relax
  // what counts as a complete initial request.
  isQualifying(email) {
    if (!subjectHasQualifyingKeywords(email.subject)) return false;
    if (isReplyMessage(email)) return false;
    return true;
  },

  // --- Field extraction - CONFIRMED 2026-09-03, calibrated against 5 real emails ---
  // (a one-time, redacted-content-only calibration fetch from welfaredw@gmail.com,
  // reviewed locally by the project owner - see docs/README.md "Calibration
  // findings"). Real emails are free-form prose, NOT "Label: value" lines - the
  // v1 assumption was wrong. Extraction runs in src/parser.js against the
  // sender's own newly-written text only, with Gmail's quoted reply history
  // (everything from "On ... wrote:" onward) stripped first - a real calibration
  // sample showed a reply's body still contains the entire prior thread,
  // including old/superseded amounts and names.

  // Amount: currency-prefixed pattern tried first; only if it finds exactly one
  // distinct match. Otherwise falls back to a narrowly-anchored bare number
  // ("loan of X" / "amount for X") - also only if exactly one distinct match.
  // Never a broad bare-number scan: that would catch phone numbers, dates, IDs,
  // reference numbers, or - when a message mentions two different amounts - pick
  // the wrong one. Any ambiguity or absence -> null -> needs_review.
  amountPatterns: [
    /LKR\.?\s*[\d][\d,]*/i,
    /(?:loan|amount)s?\s+(?:of|for)\s+([\d][\d,]{2,})/i,
  ],
  // Digit-length bounds (after stripping commas) for the bare-number fallback
  // only - excludes things like a 10-digit phone number written near the word
  // "loan" while still accepting realistic loan amounts (real samples: 5-6
  // digits, e.g. 100000).
  amountBareNumberDigitRange: { min: 4, max: 7 },

  // Loan Type: none of the 5 real samples ever stated a type in the body - the
  // only signal is the subject line. Ordered; first keyword found (anywhere in
  // the subject, case-insensitive) wins. A generic subject with no match (e.g.
  // plain "Loan Request") returns null - never defaulted to "General" or
  // anything else not actually stated.
  loanTypeKeywords: [
    ["personal", "Personal"],
    ["education", "Education"],
    ["medical", "Medical"],
    ["emergency", "Emergency"],
    ["welfare", "Welfare"],
    ["general", "General"],
  ],

  // Reason: only captured immediately after one of these exact phrases, up to
  // the next sentence end or line break. Never inferred from the surrounding
  // paragraph - real reasons are often vague ("personal reasons") and guessing
  // which sentence is "the reason" risks capturing the wrong text entirely
  // (especially with quoted history nearby, even after stripping).
  // BROADENED 2026-09-03: "to support" added after a real email said "...to
  // support my current financial requirements" - none of the original 3
  // phrases matched it.
  reasonTriggerPhrases: ["due to", "because of", "for the purpose of", "to support"],

  // A second, distinct reason pattern - CONFIRMED 2026-09-03 from a real
  // email ("...for personal reasons."). This is a different shape from the
  // trigger phrases above: it captures the descriptor together with the word
  // "reason(s)" itself, rather than "everything after the phrase to the next
  // sentence end" - a bare "for" trigger would be far too broad (matches
  // almost any sentence), so this only fires when "reason(s)" actually
  // appears nearby.
  reasonReasonWordPattern: /for\s+([a-z][a-z\s]{0,60}?\breasons?)\b/i,

  // Requested By: an approved sign-off phrase followed by a name on the next
  // line, checked first; falls back to the email's own From header display
  // name if no sign-off is found.
  signOffPhrases: ["kind regards", "regards", "sincerely", "best regards", "thanks and regards"],

  // Name cleanup - CONFIRMED 2026-09-03 from real Stage 2 output. This
  // organization's Gmail accounts are labeled "firstname digitweblanka"/
  // "firstname digitweb" - that suffix is an account-naming artifact, never
  // part of a person's actual name, and is stripped from whichever name
  // source is used (signature or From header). Never adds/guesses a name -
  // only removes this specific known-not-a-name suffix.
  nameOrganizationSuffixes: ["digitweblanka", "digitweb"],

  // Correction/follow-up safeguard - NARROWED 2026-09-03 after the first real
  // Stage 2 run. v2's word list (single generic words like "update" and
  // "follow up") flagged 7 of 18 real messages purely on wording, even though
  // all 4 fields extracted cleanly - those words are extremely common in
  // ordinary correspondence ("just following up", "please give me an
  // update"), unrelated to actually correcting missing information. Now only
  // specific, compound phrases trigger this - matched against the real
  // calibration example ("Apologies for missing the loan amount in my
  // previous email") without matching normal usage. This mostly matters for a
  // fresh (non-reply) follow-up email with a similar subject, since ordinary
  // Gmail replies are now excluded entirely by isQualifying above.
  correctionSafeguardPhrases: [
    "apologies for missing",
    "sorry for missing",
    "forgot to mention",
    "forgot to include",
    "missing the loan amount",
    "missed the amount",
    "correction to my request",
    "correction to my previous",
  ],

  // --- Loan status (6th column) - CONFIRMED 2026-09-03 --------------------------
  // A different kind of "status" from parseStatus above: parseStatus is about
  // data-extraction quality (did we read the request correctly); this is
  // about where the request stands in the real approval process (does staff
  // know about it yet, have they scheduled it). Formally revises the
  // original "exactly 5 columns" requirement to 6.
  //
  // Trust model is deliberately different from the 4 business fields: this is
  // read ONLY from replies sent by the exact staff address below - staff
  // genuinely are the authority for approval/scheduling decisions, unlike the
  // business fields, which must only ever come from the requester's own words.
  //
  // Vocabulary is minimal and evidence-based: "Submitted" (default, no staff
  // reply seen yet in the thread), "Scheduled for <Month>" (a recurring exact
  // template seen across multiple real staff replies), or "Needs manual
  // review" (a staff reply exists but its wording doesn't match the
  // recognized pattern - never guessed). No "Approved"/"Disbursed"/"Declined"
  // yet - no real email evidence for that language exists in this delivery.
  statusStaffAddress: "welfaredw@gmail.com",
  statusScheduledPattern: /scheduled\s+for\s+([A-Z][a-z]+)/i,

  // --- Date semantics - CONFIRMED 2026-09-03 ------------------------------------
  // "Date" = the Gmail received timestamp, NOT anything written in the body.
  // Chosen because it's always present and consistently formatted, so a member
  // forgetting (or mis-writing) a date line in the body can never send an
  // otherwise-valid request to "needs review". Implemented in src/parser.js
  // (deriveDate) - not extracted via fieldPatterns like the other 4 fields.
  dateSemantics: "gmail_received_date",

  // --- Acknowledgement-reply workflow -----------------------------------------
  // Grill-me decisions this is built against (2026-09-03):
  //   - draft-only, local-only: NO Gmail send, NO real thread action, ever, in this delivery.
  //   - trigger: automatically, in-pipeline, the first time a record reaches parseStatus "ok".
  //     CONFIRMED 2026-09-03 as also the intended trigger for a future live send (immediately
  //     after extraction, not gated on staff review) - not yet activated.
  //   - idempotency key: sourceId only - one draft ever per source message id.
  //   - "corrected"/"cancelled" detection is explicitly OUT of scope (deferred, see docs/README.md);
  //     this delivery only guarantees an ack is never drafted for anything but a fully-extracted
  //     "ok" record, and never drafted twice for the same sourceId.
  //   - visibility: local store fields + output/acknowledgements/*.txt files only - never the
  //     staff-facing HTML table.
  //   - review workflow for needs_review records: CONFIRMED 2026-09-03 - a staff member manually
  //     opens the original Gmail message and fills in the missing detail; no in-app correction
  //     flow exists yet.
  acknowledgement: {
    // v1 was an unapproved placeholder; v2 is the approved sender + wording below.
    // Bumping this does NOT retroactively change any already-prepared draft - see
    // docs/README.md "Acknowledgement-reply workflow".
    templateVersion: "v2",

    // CONFIRMED 2026-09-03: reply from the same mailbox the request arrived at,
    // with this approved display name.
    fromAddress: "welfaredw@gmail.com",
    fromDisplayName: "Digitweb Lanka Welfare Society",
    subjectPrefix: "Re: ",

    // CONFIRMED 2026-09-03 wording, approved verbatim. Still draft-only in this
    // delivery - nothing is sent until live Gmail sending is separately approved
    // and activated. Every extracted field is shown as plain text (not HTML).
    renderBody(record) {
      return [
        `Dear ${record.requestedBy},`,
        "",
        "We have received your welfare loan request with the following details:",
        "",
        `Date: ${record.date}`,
        `Amount: ${record.amount}`,
        `Reason: ${record.reason}`,
        `Loan Type: ${record.loanType}`,
        "",
        "Your request has been received by Digitweb Lanka Welfare Society and will be processed according to the welfare society procedure. This acknowledgement confirms receipt only and is not loan approval.",
        "",
        "Regards,",
        "Digitweb Lanka Welfare Society",
      ].join("\n");
    },
  },
};
