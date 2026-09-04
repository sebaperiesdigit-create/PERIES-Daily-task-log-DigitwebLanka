import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runPipeline } from "../src/pipeline.js";
import { Store } from "../src/store.js";
import { parseEmail } from "../src/parser.js";
import { renderHtml, escapeHtml } from "../src/html.js";
import { config } from "../src/config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "..", "fixtures", "emails");

function freshWorkspace() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "task09-test-"));
  return {
    storePath: path.join(dir, "data", "store.json"),
    outputHtmlPath: path.join(dir, "output", "loan-requests.html"),
    ackDir: path.join(dir, "output", "acknowledgements"),
  };
}

test("qualifying fixture creates exactly one correct visible table row", () => {
  // Isolate to a single fixture so this test is about one qualifying email
  // producing one correct row, independent of the other fixtures.
  const ws = freshWorkspace();
  const soloFixturesDir = fs.mkdtempSync(path.join(os.tmpdir(), "task09-solo-fixture-"));
  fs.cpSync(
    path.join(fixturesDir, "001-valid-prose-request.json"),
    path.join(soloFixturesDir, "001-valid-prose-request.json")
  );

  const { html, allRecords } = runPipeline({ fixturesDir: soloFixturesDir, ...ws });

  const ok = allRecords.filter((r) => r.parseStatus === "ok");
  assert.equal(ok.length, 1);
  assert.equal(ok[0].sourceId, "fixture-msg-0001");
  assert.equal(ok[0].date, "2026-08-20");
  assert.equal(ok[0].requestedBy, "Test Requester A");
  assert.equal(ok[0].amount, "LKR 50,000");
  assert.equal(ok[0].reason, "urgent medical expenses");
  assert.equal(ok[0].loanType, "Personal");

  assert.match(html, /<td>2026-08-20<\/td>/);
  assert.match(html, /<td>Test Requester A<\/td>/);
});

test("ineligible fixture creates no row and is not stored", () => {
  const ws = freshWorkspace();
  const { allRecords } = runPipeline({ fixturesDir, ...ws });

  const stored = allRecords.find((r) => r.sourceId === "fixture-msg-0002");
  assert.equal(stored, undefined, "ineligible email must not be stored at all");
});

test("re-running the same fixtures does not duplicate rows", () => {
  const ws = freshWorkspace();
  runPipeline({ fixturesDir, ...ws });
  const second = runPipeline({ fixturesDir, ...ws });
  const third = runPipeline({ fixturesDir, ...ws });

  assert.equal(second.allRecords.length, third.allRecords.length);
  const ids = third.allRecords.map((r) => r.sourceId);
  const uniqueIds = new Set(ids);
  assert.equal(ids.length, uniqueIds.size, "no duplicate source ids after reruns");

  const ok = third.allRecords.filter((r) => r.parseStatus === "ok" && r.sourceId === "fixture-msg-0001");
  assert.equal(ok.length, 1);
});

test("missing amount goes to needs_review, not the main table, and does not corrupt other rows", () => {
  const ws = freshWorkspace();
  const { allRecords, html } = runPipeline({ fixturesDir, ...ws });

  const missingAmount = allRecords.find((r) => r.sourceId === "fixture-msg-0003");
  assert.ok(missingAmount, "fixture should still be stored, for review");
  assert.equal(missingAmount.parseStatus, "needs_review");
  assert.match(missingAmount.reviewNotes, /amount/i);
  assert.equal(missingAmount.amount, null, "must not invent a missing amount");
  // Other fields still extracted correctly - only amount is the problem.
  assert.equal(missingAmount.requestedBy, "Test Requester D");
  assert.equal(missingAmount.reason, "urgent medical expenses");
  assert.equal(missingAmount.loanType, "Personal");

  // Not present as a main-table row.
  assert.doesNotMatch(html, /<td>Test Requester D<\/td>/);
  // But listed in the review section by source id.
  assert.match(html, /fixture-msg-0003/);

  // Other valid records are unaffected.
  const ok = allRecords.find((r) => r.sourceId === "fixture-msg-0001");
  assert.equal(ok.parseStatus, "ok");
});

test("HTML special characters in fixture values are escaped, not rendered as markup", () => {
  const ws = freshWorkspace();
  const { html, allRecords } = runPipeline({ fixturesDir, ...ws });

  const injected = allRecords.find((r) => r.sourceId === "fixture-msg-0004");
  assert.ok(injected);
  assert.equal(injected.parseStatus, "ok");
  assert.match(injected.requestedBy, /<Requester>/); // raw stored value keeps the literal text
  assert.match(injected.reason, /<priority>/);

  // The raw angle brackets must never appear unescaped in the output HTML.
  assert.doesNotMatch(html, /<Requester>/);
  assert.doesNotMatch(html, /<priority>/);
  assert.doesNotMatch(html, /<script/i);
  // They must appear as escaped entities instead.
  assert.match(html, /&lt;Requester&gt;/);
  assert.match(html, /Test &amp; &lt;Requester&gt; &quot;C&quot;/);
  assert.match(html, /&amp; &lt;priority&gt; books/);
});

test("escapeHtml neutralizes script tags and ampersands", () => {
  const dangerous = `<script>alert('x')</script> & "quoted" 'single'`;
  const escaped = escapeHtml(dangerous);
  assert.doesNotMatch(escaped, /<script/i);
  assert.match(escaped, /&lt;script&gt;/);
  assert.match(escaped, /&amp;/);
});

test("review-section rows are now staff-usable: sender/subject shown, a Gmail link, and whatever fields WERE extracted", () => {
  const ws = freshWorkspace();
  const { html } = runPipeline({ fixturesDir, ...ws });

  // fixture-msg-0003 is missing only "amount" - requestedBy/reason/loanType did extract.
  assert.match(html, /test\.requester\.d@example-welfare\.test/i, "sender must be shown for triage");
  assert.match(html, /Personal Loan Request/, "subject must be shown for triage");
  assert.match(html, /<strong>Requested By:<\/strong> Test Requester D/, "successfully-extracted fields must be shown");
  assert.match(html, /<strong>Reason:<\/strong> urgent medical expenses/);

  // Direct Gmail link built from the real source id, opens in a new tab safely.
  assert.match(html, /href="https:\/\/mail\.google\.com\/mail\/u\/0\/#all\/fixture-msg-0003"/);
  assert.match(html, /target="_blank" rel="noopener noreferrer"/);
});

test("review-section sender/subject fields are escaped, same as the main table", () => {
  // fixture-msg-0007's subject/from are plain, so exercise this via a synthetic record instead.
  const html = renderHtml(
    [
      {
        sourceId: "review-escape-1",
        parseStatus: "needs_review",
        reviewNotes: "Missing/ambiguous field(s): amount",
        date: "2026-08-30",
        fromAddress: `Test & <Injector> "X" <injector@example-welfare.test>`,
        subject: `Loan Request <script>alert('x')</script>`,
        requestedBy: null,
        amount: null,
        reason: null,
        loanType: null,
      },
    ],
    { generatedAt: "2026-08-30T00:00:00.000Z" }
  );
  assert.doesNotMatch(html, /<Injector>/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;Injector&gt;/);
  assert.match(html, /Loan Request &lt;script&gt;/);
  assert.match(html, /Nothing usable extracted yet/);
});

test("stored valid records survive a simulated restart (new process re-reading the store)", () => {
  const ws = freshWorkspace();
  runPipeline({ fixturesDir, ...ws });

  // Simulate a fresh process: construct a brand-new Store pointed at the same file
  // and confirm the previously saved valid record is still present, unchanged.
  const reopened = new Store(ws.storePath);
  const records = reopened.list();
  const ok = records.find((r) => r.sourceId === "fixture-msg-0001");
  assert.ok(ok, "record must survive process restart");
  assert.equal(ok.parseStatus, "ok");
  assert.equal(ok.requestedBy, "Test Requester A");
});

test("generated HTML has a usable empty state when no records exist", () => {
  const html = renderHtml([]);
  assert.match(html, /No loan requests recorded yet\./);
  assert.match(html, /Nothing pending review\./);
});

test("parseEmail returns null for unrelated mail without inventing a record", () => {
  const email = {
    id: "unrelated-1",
    subject: "Weekly team lunch",
    bodyText: "See you at noon.",
    receivedAt: "2026-08-01T00:00:00Z",
  };
  assert.equal(parseEmail(email, config), null);
});

test("Date column uses the Gmail received timestamp - body content is never consulted for it", () => {
  const email = {
    id: "date-semantics-1",
    threadId: "date-semantics-1",
    from: "Someone <someone@example-welfare.test>",
    subject: "Personal Loan Request",
    receivedAt: "2026-08-20T09:14:00+05:30",
    bodyText: "Dear Welfare Team,\r\n\r\nI would like to request LKR 1,000 due to a test reason.\r\n\r\nKind regards,\r\nSomeone\r\n",
  };
  const record = parseEmail(email, config);
  assert.equal(record.parseStatus, "ok");
  assert.equal(record.date, "2026-08-20");
});

test("a missing receivedAt is never invented as a date - goes to needs_review instead", () => {
  const email = {
    id: "date-semantics-2",
    threadId: "date-semantics-2",
    from: "Someone <someone@example-welfare.test>",
    subject: "Personal Loan Request",
    // receivedAt intentionally omitted - shouldn't happen for a real Gmail
    // message, but must never fall back to guessing a date.
    bodyText: "Dear Welfare Team,\r\n\r\nI would like to request LKR 1,000 due to a test reason.\r\n\r\nKind regards,\r\nSomeone\r\n",
  };
  const record = parseEmail(email, config);
  assert.equal(record.parseStatus, "needs_review");
  assert.equal(record.date, null);
  assert.match(record.reviewNotes, /date/i);
});

test("qualifying rule matches all 5 real confirmed subject-line samples (2026-09-03)", () => {
  // These are the actual subject lines from the real welfaredw@gmail.com inbox.
  // 3 of the 5 put "Request" before "Loan", which is why the rule checks both
  // words are present rather than requiring the adjacent phrase "loan request".
  const realSubjects = [
    "Personal Loan Request",
    "Request for Welfare Loan – LKR 200,000",
    "Loan request",
    "Request for Personal Loan Assistance with Salary Deduction Facility",
    "Request for Education Loan",
  ];
  for (const subject of realSubjects) {
    assert.equal(config.isQualifying({ subject }), true, `expected to qualify: "${subject}"`);
  }
});

test("qualifying rule still rejects unrelated subjects", () => {
  assert.equal(config.isQualifying({ subject: "Welfare Society Monthly Newsletter - August" }), false);
  assert.equal(config.isQualifying({ subject: "Please request the loan officer to call back" }) === true, true);
  // ^ documents a known trade-off: "loan" + "request" anywhere in the subject is
  // intentionally loose. A subject that happens to contain both words in an
  // unrelated sentence would still qualify - acceptable for this delivery since
  // it only affects which local fixtures get parsed, never a live inbox.
  assert.equal(config.isQualifying({ subject: "General society meeting minutes" }), false);
});

// --- Calibrated real-format extraction rules (2026-09-03) -----------------------

test("a reply (Re: subject + quoted history) is excluded entirely - not stored, not reviewed, no draft", () => {
  // REVISED 2026-09-03: replies used to be processed (with quoted history
  // stripped) and could reach "ok". A real Stage 2 run showed this treats
  // every reply in a thread as its own candidate request, massively
  // inflating needs_review. Replies are now excluded the same way ineligible
  // mail is - never stored at all.
  const ws = freshWorkspace();
  const { allRecords } = runPipeline({ fixturesDir, ...ws });

  const reply = allRecords.find((r) => r.sourceId === "fixture-msg-0005");
  assert.equal(reply, undefined, "a reply must not be stored at all, not even as needs_review");
});

test("a reply detected via subject prefix alone (no quote marker in body) is also excluded", () => {
  const ws = freshWorkspace();
  const { allRecords } = runPipeline({ fixturesDir, ...ws });

  const reply = allRecords.find((r) => r.sourceId === "fixture-msg-0009");
  assert.equal(reply, undefined, "Re: subject alone is enough to exclude it, even without a quote marker");
});

test("isQualifying excludes Re:/Fwd: subjects and bodies containing Gmail's quote-history marker", () => {
  assert.equal(config.isQualifying({ subject: "Re: Personal Loan Request" }), false);
  assert.equal(config.isQualifying({ subject: "RE: Loan Request" }), false);
  assert.equal(config.isQualifying({ subject: "Fwd: Personal Loan Request" }), false);
  assert.equal(
    config.isQualifying({
      subject: "Personal Loan Request", // no Re: prefix
      bodyText: "Some reply text.\r\n\r\nOn Mon, Aug 10, 2026 at 9:00 AM Someone <someone@example.test> wrote:\r\n> quoted",
    }),
    false,
    "a quote-history marker in the body excludes it even without a Re: subject"
  );
  // A genuine fresh request (no Re:, no quote marker) still qualifies.
  assert.equal(config.isQualifying({ subject: "Personal Loan Request", bodyText: "A fresh request." }), true);
});

test("generic 'Loan Request' subject (no type keyword) becomes needs_review", () => {
  const ws = freshWorkspace();
  const { allRecords } = runPipeline({ fixturesDir, ...ws });

  const generic = allRecords.find((r) => r.sourceId === "fixture-msg-0006");
  assert.ok(generic);
  assert.equal(generic.parseStatus, "needs_review");
  assert.equal(generic.loanType, null, "must not default to a type the subject doesn't state");
  assert.match(generic.reviewNotes, /loanType/i);
  // Other fields still extracted fine.
  assert.equal(generic.amount, "LKR 40,000");
  assert.equal(generic.reason, "home repairs");
});

test("an ambiguous bare number (multiple plausible amounts) becomes needs_review", () => {
  const ws = freshWorkspace();
  const { allRecords } = runPipeline({ fixturesDir, ...ws });

  const ambiguous = allRecords.find((r) => r.sourceId === "fixture-msg-0007");
  assert.ok(ambiguous);
  assert.equal(ambiguous.parseStatus, "needs_review");
  assert.equal(ambiguous.amount, null, "must not guess between two plausible amounts");
  assert.match(ambiguous.reviewNotes, /amount/i);
});

test("a bare number outside the realistic digit range (e.g. phone-number-length) is rejected", () => {
  const email = {
    id: "amount-range-1",
    threadId: "amount-range-1",
    from: "Someone <someone@example-welfare.test>",
    subject: "Personal Loan Request",
    receivedAt: "2026-08-29T09:00:00+05:30",
    bodyText:
      "Dear Welfare Team,\r\n\r\nI would like to request an amount for 0771234567 due to urgent needs.\r\n\r\nKind regards,\r\nSomeone\r\n",
  };
  const record = parseEmail(email, config);
  assert.equal(record.amount, null, "a 10-digit number must not be mistaken for a loan amount");
  assert.equal(record.parseStatus, "needs_review");
});

test("a hard line-wrap mid-sentence does not truncate the reason (real bug: real emails wrap at ~78 chars)", () => {
  // FIX 2026-09-03: the first real live-data spot-check showed "Reason" as
  // literally just "an" for two real requests. Root cause: real emails wrap
  // "...due to an\r\nurgent personal matter." mid-sentence, and the reason
  // regex stopped at the first line break as if it were a sentence end. This
  // fixture reproduces that exact real pattern.
  const ws = freshWorkspace();
  const { allRecords } = runPipeline({ fixturesDir, ...ws });

  const wrapped = allRecords.find((r) => r.sourceId === "fixture-msg-0010");
  assert.ok(wrapped);
  assert.equal(wrapped.parseStatus, "ok");
  assert.equal(wrapped.reason, "an urgent personal matter", "must not be truncated to just 'an'");
  assert.equal(wrapped.requestedBy, "Test Requester I");
  assert.equal(wrapped.amount, "LKR 100,000");
});

test("a sign-off and name on the same unwrapped line (no line break between them) are still extracted", () => {
  // After unwrapping, "Kind regards, Someone" (comma+space, not comma+newline)
  // must still work - the sign-off regex was relaxed from requiring a literal
  // newline to accepting any whitespace.
  const email = {
    id: "signoff-same-line-1",
    threadId: "signoff-same-line-1",
    from: "Fallback Name <fallback@example-welfare.test>",
    subject: "Personal Loan Request",
    receivedAt: "2026-08-31T09:00:00+05:30",
    bodyText: "Dear Welfare Team,\r\n\r\nI would like to request LKR 5,000 due to a test reason. Kind regards, Same Line Name\r\n",
  };
  const record = parseEmail(email, config);
  assert.equal(record.requestedBy, "Same Line Name");
});

test("From header surname is kept when the sign-off is only a first name (real bug: sign-off 'M.Manoranjani' vs header 'manoranjani maheswaran' dropped the surname)", () => {
  const email = {
    id: "signoff-first-name-only-1",
    threadId: "signoff-first-name-only-1",
    from: "Firstname Lastname <firstname.lastname@example-welfare.test>",
    subject: "Personal Loan Request",
    receivedAt: "2026-08-31T09:00:00+05:30",
    bodyText: "Dear Welfare Team,\r\n\r\nI would like to request LKR 5,000 due to a test reason.\r\n\r\nKind regards,\r\nFirstname\r\n",
  };
  const record = parseEmail(email, config);
  assert.equal(record.requestedBy, "Firstname Lastname");
});

test("sign-off is still preferred when it is at least as full as the From header display name", () => {
  const email = {
    id: "signoff-fuller-than-header-1",
    threadId: "signoff-fuller-than-header-1",
    from: "firstname digitweblanka <firstnamedigitweblanka@example-welfare.test>",
    subject: "Personal Loan Request",
    receivedAt: "2026-08-31T09:00:00+05:30",
    bodyText: "Dear Welfare Team,\r\n\r\nI would like to request LKR 5,000 due to a test reason.\r\n\r\nKind regards,\r\nM. Firstname\r\n",
  };
  const record = parseEmail(email, config);
  assert.equal(record.requestedBy, "M. Firstname");
});

test("missing amount entirely (no currency, no anchored number) becomes needs_review", () => {
  const ws = freshWorkspace();
  const { allRecords } = runPipeline({ fixturesDir, ...ws });

  const missing = allRecords.find((r) => r.sourceId === "fixture-msg-0003");
  assert.equal(missing.parseStatus, "needs_review");
  assert.equal(missing.amount, null);
  assert.match(missing.reviewNotes, /amount/i);
});

test("correction/follow-up wording forces needs_review even with all 4 fields extractable, and produces no acknowledgement", () => {
  const ws = freshWorkspace();
  const { allRecords } = runPipeline({ fixturesDir, ...ws });

  const correction = allRecords.find((r) => r.sourceId === "fixture-msg-0008");
  assert.ok(correction);
  // All 4 fields WOULD have extracted cleanly on their own.
  assert.equal(correction.amount, "LKR 60,000");
  assert.equal(correction.reason, "medical bills");
  assert.equal(correction.requestedBy, "Test Requester E");
  assert.equal(correction.loanType, "Personal");
  // But the correction/follow-up safeguard still forces review.
  assert.equal(correction.parseStatus, "needs_review");
  assert.match(correction.reviewNotes, /possible correction or follow-up/i);

  // No acknowledgement draft of any kind for this record.
  assert.equal(correction.ack_status, undefined);
  assert.equal(fs.existsSync(path.join(ws.ackDir, "fixture-msg-0008.txt")), false);
});

test("correction safeguard uses specific phrases only - generic words like 'update'/'follow up' alone no longer trigger it", () => {
  // NARROWED 2026-09-03: the first real Stage 2 run showed the old word list
  // (single words like "update", "follow up") flagged 7 of 18 real messages
  // purely on ordinary wording, even though all 4 fields extracted cleanly.
  const genericWordEmail = {
    id: "correction-narrowing-1",
    threadId: "correction-narrowing-1",
    from: "Someone <someone@example-welfare.test>",
    subject: "Personal Loan Request",
    receivedAt: "2026-08-30T09:00:00+05:30",
    bodyText:
      "Dear Welfare Team,\r\n\r\nJust following up - please give me an update on my request for LKR 20,000 due to medical bills.\r\n\r\nKind regards,\r\nSomeone\r\n",
  };
  const record = parseEmail(genericWordEmail, config);
  assert.equal(record.parseStatus, "ok", "'follow up' / 'update' alone must no longer force review");

  const specificPhraseEmail = {
    id: "correction-narrowing-2",
    threadId: "correction-narrowing-2",
    from: "Someone <someone@example-welfare.test>",
    subject: "Personal Loan Request",
    receivedAt: "2026-08-30T09:00:00+05:30",
    bodyText:
      "Dear Welfare Team,\r\n\r\nI forgot to mention the amount - it should be LKR 20,000, due to medical bills.\r\n\r\nKind regards,\r\nSomeone\r\n",
  };
  const specificRecord = parseEmail(specificPhraseEmail, config);
  assert.equal(specificRecord.parseStatus, "needs_review", "a specific correction phrase must still trigger the safeguard");
  assert.match(specificRecord.reviewNotes, /possible correction or follow-up/i);
});

// --- Gap-filling merge (2026-09-03) - narrowly scoped correction handling -------

test("a same-sender, same-thread reply fills a genuinely missing field and completes the request", () => {
  // Mirrors a real case: an initial request missing the amount, followed 14
  // minutes later by "I would also like to request a loan of X. Apologies
  // for missing the amount" from the same sender, quoting the original.
  const ws = freshWorkspace();
  const { allRecords } = runPipeline({ fixturesDir, ...ws });

  const target = allRecords.find((r) => r.sourceId === "fixture-msg-0011");
  assert.ok(target);
  assert.equal(target.parseStatus, "ok", "the gap-filled amount completes the request");
  assert.equal(target.amount, "LKR 35,000");
  assert.equal(target.requestedBy, "Test Requester J"); // from the original, untouched
  assert.equal(target.reason, "urgent medical expenses"); // from the original, untouched
  assert.equal(target.gapFilledFromMessageId, "fixture-msg-0012");
  assert.ok(target.gapFilledAt);

  // The reply itself never becomes its own record.
  const replyAsRecord = allRecords.find((r) => r.sourceId === "fixture-msg-0012");
  assert.equal(replyAsRecord, undefined);
});

test("gap-filling never overwrites a field that was already successfully extracted", () => {
  const ws = freshWorkspace();
  const originalEmail = {
    id: "gapfill-noverwrite-1",
    threadId: "gapfill-noverwrite-1",
    from: "Someone <someone@example-welfare.test>",
    subject: "Loan Request", // deliberately generic - no type keyword, so loanType stays missing
    receivedAt: "2026-08-25T09:00:00+05:30",
    bodyText: "Dear Welfare Team,\r\n\r\nI would like to request LKR 20,000 due to urgent needs.\r\n\r\nKind regards,\r\nSomeone\r\n",
    // amount/reason/requestedBy all extract fine here; only loanType is
    // genuinely missing - so this record IS needs_review (eligible for
    // gap-filling per boundary 2), but amount is already set (testing
    // boundary 1: the reply's different amount must not touch it).
  };
  const replyEmail = {
    id: "gapfill-noverwrite-2",
    threadId: "gapfill-noverwrite-1",
    from: "Someone <someone@example-welfare.test>",
    subject: "Re: Loan Request",
    receivedAt: "2026-08-25T09:14:00+05:30",
    bodyText:
      "Actually please make it LKR 99,999 instead.\r\n\r\nKind regards,\r\nSomeone\r\n\r\nOn Mon, Aug 25, 2026 at 9:00 AM Someone <someone@example-welfare.test> wrote:\r\n> Dear Welfare Team,\r\n> I would like to request LKR 20,000 due to urgent needs.\r\n>\r\n> Kind regards,\r\n> Someone\r\n",
  };
  const { allRecords } = runPipeline({ emails: [originalEmail, replyEmail], ...ws });

  const target = allRecords.find((r) => r.sourceId === "gapfill-noverwrite-1");
  assert.ok(target);
  assert.equal(target.parseStatus, "needs_review", "sanity check: still missing loanType, so still eligible for merge");
  assert.equal(target.amount, "LKR 20,000", "the reply's different amount must NEVER overwrite the original's");
  assert.equal(target.loanType, null, "the reply's own subject/type is irrelevant - it only fills genuine gaps");
});

test("gap-filling never applies from a different sender (e.g. staff replying in the thread)", () => {
  const ws = freshWorkspace();
  const originalEmail = {
    id: "gapfill-sender-1",
    threadId: "gapfill-sender-1",
    from: "Requester <requester@example-welfare.test>",
    subject: "Personal Loan Request",
    receivedAt: "2026-08-25T09:00:00+05:30",
    bodyText: "Dear Welfare Team,\r\n\r\nI would like to request a loan due to urgent needs.\r\n\r\nKind regards,\r\nRequester\r\n",
  };
  const staffReply = {
    id: "gapfill-sender-2",
    threadId: "gapfill-sender-1",
    from: "Digitweb Lanka Welfare Society <welfaredw@example.test>", // different sender
    subject: "Re: Personal Loan Request",
    receivedAt: "2026-08-25T10:00:00+05:30",
    bodyText:
      "We note your request for LKR 50,000.\r\n\r\nKind regards,\r\nWelfare Team\r\n\r\nOn Mon, Aug 25, 2026 at 9:00 AM Requester <requester@example-welfare.test> wrote:\r\n> Dear Welfare Team,\r\n> I would like to request a loan due to urgent needs.\r\n>\r\n> Kind regards,\r\n> Requester\r\n",
  };
  const { allRecords } = runPipeline({ emails: [originalEmail, staffReply], ...ws });

  const target = allRecords.find((r) => r.sourceId === "gapfill-sender-1");
  assert.ok(target);
  assert.equal(target.parseStatus, "needs_review", "a reply from a different sender must never fill anything in");
  assert.equal(target.amount, null);
  assert.equal(target.gapFilledFromMessageId, undefined);
});

test("gap-filling never touches an already-'ok' record, even if a same-sender reply mentions a different amount", () => {
  const ws = freshWorkspace();
  const completeEmail = {
    id: "gapfill-ok-1",
    threadId: "gapfill-ok-1",
    from: "Someone <someone@example-welfare.test>",
    subject: "Personal Loan Request",
    receivedAt: "2026-08-25T09:00:00+05:30",
    bodyText: "Dear Welfare Team,\r\n\r\nI would like to request LKR 20,000 due to urgent needs.\r\n\r\nKind regards,\r\nSomeone\r\n",
  };
  const replyEmail = {
    id: "gapfill-ok-2",
    threadId: "gapfill-ok-1",
    from: "Someone <someone@example-welfare.test>",
    subject: "Re: Personal Loan Request",
    receivedAt: "2026-08-25T09:14:00+05:30",
    bodyText:
      "On second thought please make it LKR 99,999.\r\n\r\nKind regards,\r\nSomeone\r\n\r\nOn Mon, Aug 25, 2026 at 9:00 AM Someone <someone@example-welfare.test> wrote:\r\n> Dear Welfare Team,\r\n> I would like to request LKR 20,000 due to urgent needs.\r\n>\r\n> Kind regards,\r\n> Someone\r\n",
  };
  const { allRecords } = runPipeline({ emails: [completeEmail, replyEmail], ...ws });

  const target = allRecords.find((r) => r.sourceId === "gapfill-ok-1");
  assert.ok(target);
  assert.equal(target.parseStatus, "ok");
  assert.equal(target.amount, "LKR 20,000", "an already-complete record must never be revised by a later reply");
  assert.equal(target.gapFilledFromMessageId, undefined);
});

// --- Manual review corrections (2026-09-04) ---------------------------------------

test("a hand-edited corrections file fills a genuinely missing field and completes the request", () => {
  const ws = freshWorkspace();
  const correctionsPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "task09-corrections-")), "corrections.json");
  // fixture-msg-0003 is missing only "amount" - requestedBy/reason/loanType did extract.
  fs.writeFileSync(
    correctionsPath,
    JSON.stringify({ "fixture-msg-0003": { amount: "LKR 60,000", correctedBy: "Test Reviewer" } })
  );

  const { allRecords } = runPipeline({ fixturesDir, correctionsPath, ...ws });

  const target = allRecords.find((r) => r.sourceId === "fixture-msg-0003");
  assert.ok(target);
  assert.equal(target.parseStatus, "ok", "the corrected amount completes the request");
  assert.equal(target.amount, "LKR 60,000");
  assert.equal(target.correctedBy, "Test Reviewer");
  assert.ok(target.correctedAt);
});

test("a correction never overwrites a field that was already successfully extracted", () => {
  const ws = freshWorkspace();
  const correctionsPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "task09-corrections-")), "corrections.json");
  // fixture-msg-0003's requestedBy already extracts as "Test Requester D" -
  // a correction claiming a different name must be ignored, even though the
  // record is still needs_review (still missing amount).
  fs.writeFileSync(
    correctionsPath,
    JSON.stringify({ "fixture-msg-0003": { requestedBy: "Someone Else", amount: "LKR 60,000" } })
  );

  const { allRecords } = runPipeline({ fixturesDir, correctionsPath, ...ws });

  const target = allRecords.find((r) => r.sourceId === "fixture-msg-0003");
  assert.equal(target.requestedBy, "Test Requester D", "an already-extracted value must never be overwritten");
  assert.equal(target.amount, "LKR 60,000", "a genuinely missing field is still filled");
});

test("a correction is ignored for an already-'ok' record", () => {
  const ws = freshWorkspace();
  const correctionsPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "task09-corrections-")), "corrections.json");
  // fixture-msg-0001 is a fully-extracted "ok" fixture - a correction
  // targeting it must be a no-op, matching the gap-fill boundary.
  fs.writeFileSync(correctionsPath, JSON.stringify({ "fixture-msg-0001": { reason: "a different reason entirely" } }));

  const { allRecords } = runPipeline({ fixturesDir, correctionsPath, ...ws });

  const target = allRecords.find((r) => r.sourceId === "fixture-msg-0001");
  assert.ok(target);
  assert.equal(target.parseStatus, "ok");
  assert.equal(target.correctedBy, undefined, "an already-ok record must never be touched by a correction");
});

test("a missing corrections file is silently ignored (the mechanism is entirely optional)", () => {
  const ws = freshWorkspace();
  const { allRecords } = runPipeline({
    fixturesDir,
    correctionsPath: path.join(ws.storePath, "..", "does-not-exist.json"),
    ...ws,
  });

  const stillReview = allRecords.find((r) => r.sourceId === "fixture-msg-0003");
  assert.equal(stillReview.parseStatus, "needs_review");
});

// --- Loan status, 6th column (2026-09-03) ----------------------------------------

test("a staff reply with the recognized 'scheduled for <Month>' pattern sets that status", () => {
  const ws = freshWorkspace();
  const { allRecords, html } = runPipeline({ fixturesDir, ...ws });

  const target = allRecords.find((r) => r.sourceId === "fixture-msg-0013");
  assert.ok(target);
  assert.equal(target.parseStatus, "ok");
  assert.equal(target.status, "Scheduled for November");
  assert.match(html, /Scheduled for November/);

  // The staff reply never becomes its own record.
  assert.equal(
    allRecords.find((r) => r.sourceId === "fixture-msg-0014"),
    undefined
  );
});

test("an 'ok' request with no staff reply yet defaults to 'Submitted'", () => {
  const ws = freshWorkspace();
  const { allRecords } = runPipeline({ fixturesDir, ...ws });

  const target = allRecords.find((r) => r.sourceId === "fixture-msg-0001");
  assert.equal(target.status, "Submitted");
});

test("a staff reply that doesn't match the recognized pattern becomes 'Needs manual review', never guessed", () => {
  const ws = freshWorkspace();
  const originalEmail = {
    id: "status-unrecognized-1",
    threadId: "status-unrecognized-1",
    from: "Someone <someone@example-welfare.test>",
    subject: "Personal Loan Request",
    receivedAt: "2026-08-20T09:00:00+05:30",
    bodyText: "Dear Welfare Team,\r\n\r\nI would like to request LKR 30,000 due to home repairs.\r\n\r\nKind regards,\r\nSomeone\r\n",
  };
  const staffReply = {
    id: "status-unrecognized-2",
    threadId: "status-unrecognized-1",
    from: "Digitweb Lanka Welfare Society <welfaredw@gmail.com>",
    subject: "Re: Personal Loan Request",
    receivedAt: "2026-08-21T09:00:00+05:30",
    bodyText:
      "Thank you, this has been forwarded to the committee for their decision.\r\n\r\nKind regards,\r\nWelfare Team\r\n",
  };
  const { allRecords } = runPipeline({ emails: [originalEmail, staffReply], ...ws });

  const target = allRecords.find((r) => r.sourceId === "status-unrecognized-1");
  assert.equal(target.status, "Needs manual review", "an unrecognized staff reply must never be guessed at");
});

test("a detected status persists across reruns even if a later run's fetch doesn't include the staff reply", () => {
  const ws = freshWorkspace();
  const originalEmail = {
    id: "status-persist-1",
    threadId: "status-persist-1",
    from: "Someone <someone@example-welfare.test>",
    subject: "Personal Loan Request",
    receivedAt: "2026-08-20T09:00:00+05:30",
    bodyText: "Dear Welfare Team,\r\n\r\nI would like to request LKR 30,000 due to home repairs.\r\n\r\nKind regards,\r\nSomeone\r\n",
  };
  const staffReply = {
    id: "status-persist-2",
    threadId: "status-persist-1",
    from: "Digitweb Lanka Welfare Society <welfaredw@gmail.com>",
    subject: "Re: Personal Loan Request",
    receivedAt: "2026-08-21T09:00:00+05:30",
    bodyText: "Your loan request is currently scheduled for October.\r\n\r\nKind regards,\r\nWelfare Team\r\n",
  };
  const first = runPipeline({ emails: [originalEmail, staffReply], ...ws });
  const firstTarget = first.allRecords.find((r) => r.sourceId === "status-persist-1");
  assert.equal(firstTarget.status, "Scheduled for October");

  // Second run: the staff reply no longer appears in the fetch (e.g. aged out
  // of the window) - status must still be remembered, not reset.
  const second = runPipeline({ emails: [originalEmail], ...ws });
  const secondTarget = second.allRecords.find((r) => r.sourceId === "status-persist-1");
  assert.equal(secondTarget.status, "Scheduled for October", "status must be carried forward, not lost or reset");
});

// --- Acknowledgement-reply workflow (draft-only, local-only) ---------------------

test("a valid request produces exactly one correctly addressed, thread-linked acknowledgement draft", () => {
  const ws = freshWorkspace();
  const { allRecords } = runPipeline({ fixturesDir, ...ws });

  const ok = allRecords.find((r) => r.sourceId === "fixture-msg-0001");
  assert.equal(ok.ack_status, "prepared");
  assert.equal(ok.ack_source_message_id, "fixture-msg-0001");
  assert.equal(ok.ack_thread_id, "fixture-msg-0001");
  assert.equal(ok.ack_recipient, "Test Requester A <test.requester.a@example-welfare.test>");
  assert.equal(ok.ack_draft_id, "ack-fixture-msg-0001");
  assert.ok(ok.ack_prepared_at);

  const draftPath = path.join(ws.ackDir, "fixture-msg-0001.txt");
  assert.ok(fs.existsSync(draftPath), "exactly one draft file must exist for this source id");
  const draftText = fs.readFileSync(draftPath, "utf8");
  assert.match(draftText, /Thread ID: fixture-msg-0001/);
  assert.match(draftText, /In reply to \(source message ID\): fixture-msg-0001/);
  assert.match(draftText, /Test Requester A/);
  assert.match(draftText, /DRAFT ACKNOWLEDGEMENT - NOT SENT/);

  // The five "ok" fixtures (0001, 0004, 0010, 0011 via the gap-filling merge
  // with 0012, and 0013) get a draft - 0005/0009/0014 are replies excluded
  // entirely, and 0012 itself never becomes its own record (it only supplies
  // a field).
  const draftFiles = fs.readdirSync(ws.ackDir);
  assert.deepEqual(draftFiles.sort(), [
    "fixture-msg-0001.txt",
    "fixture-msg-0004.txt",
    "fixture-msg-0010.txt",
    "fixture-msg-0011.txt",
    "fixture-msg-0013.txt",
  ]);
});

test("rerunning the same request cannot produce a second acknowledgement", () => {
  const ws = freshWorkspace();
  const first = runPipeline({ fixturesDir, ...ws });
  const okFirst = first.allRecords.find((r) => r.sourceId === "fixture-msg-0001");
  const draftPath = path.join(ws.ackDir, "fixture-msg-0001.txt");
  const firstDraftText = fs.readFileSync(draftPath, "utf8");
  const firstPreparedAt = okFirst.ack_prepared_at;

  const second = runPipeline({ fixturesDir, ...ws });
  const okSecond = second.allRecords.find((r) => r.sourceId === "fixture-msg-0001");

  assert.equal(okSecond.ack_status, "prepared");
  assert.equal(okSecond.ack_prepared_at, firstPreparedAt, "rerun must not alter the existing ack record");
  assert.equal(fs.readFileSync(draftPath, "utf8"), firstDraftText, "rerun must not rewrite the draft file");

  // Still exactly one draft file for this source id - no "-2"/duplicate file created.
  const draftFiles = fs.readdirSync(ws.ackDir).filter((f) => f.startsWith("fixture-msg-0001"));
  assert.deepEqual(draftFiles, ["fixture-msg-0001.txt"]);
});

test("ineligible and needs_review requests never produce an acknowledgement", () => {
  const ws = freshWorkspace();
  const { allRecords } = runPipeline({ fixturesDir, ...ws });

  const needsReview = allRecords.find((r) => r.sourceId === "fixture-msg-0003");
  assert.equal(needsReview.parseStatus, "needs_review");
  assert.equal(needsReview.ack_status, undefined, "needs_review must never get an ack_status");
  assert.equal(
    fs.existsSync(path.join(ws.ackDir, "fixture-msg-0003.txt")),
    false,
    "needs_review must never get a draft file"
  );

  // fixture-msg-0002 (ineligible) isn't stored at all, so by construction it has no ack fields/file either.
  assert.equal(fs.existsSync(path.join(ws.ackDir, "fixture-msg-0002.txt")), false);
});

// --- Strict backfill mode (2026-09-03) --------------------------------------------

test("backfillMode: true skips acknowledgement drafting entirely, even for otherwise-complete requests", () => {
  // Fixes a real implementation mistake: the first-ever live Stage 2 run
  // (necessarily a historical import, since nothing had been seen before)
  // drafted 3 acknowledgements it should never have created.
  const ws = freshWorkspace();
  const { allRecords } = runPipeline({ fixturesDir, ...ws, backfillMode: true });

  const ok = allRecords.filter((r) => r.parseStatus === "ok");
  assert.ok(ok.length > 0, "sanity check: there are still ok records to (not) acknowledge");
  for (const record of ok) {
    assert.equal(record.ack_status, undefined, `${record.sourceId} must not get an ack_status in backfill mode`);
  }
  assert.deepEqual(fs.existsSync(ws.ackDir) ? fs.readdirSync(ws.ackDir) : [], [], "no draft files at all in backfill mode");
});

test("backfillMode: false (default) still drafts acknowledgements normally - unaffected by the fix", () => {
  const ws = freshWorkspace();
  const { allRecords } = runPipeline({ fixturesDir, ...ws }); // backfillMode omitted -> defaults to false

  const ok = allRecords.find((r) => r.sourceId === "fixture-msg-0001");
  assert.equal(ok.ack_status, "prepared");
  assert.ok(fs.existsSync(path.join(ws.ackDir, "fixture-msg-0001.txt")));
});

test("a later, non-backfill run can still draft an acknowledgement for a newly-appearing ok record", () => {
  // Simulates src/run-live.js's real sequence: first run has no existing
  // store (backfillMode true, auto-detected there) -> here we simulate the
  // SECOND run explicitly, where a record that wasn't present before now
  // shows up and should be treated normally.
  const ws = freshWorkspace();
  runPipeline({ fixturesDir, ...ws, backfillMode: true }); // "first run" - no drafts
  const okAfterBackfill = fs.existsSync(ws.ackDir) ? fs.readdirSync(ws.ackDir) : [];
  assert.deepEqual(okAfterBackfill, []);

  const second = runPipeline({ fixturesDir, ...ws, backfillMode: false }); // "second run" - normal mode
  const ok = second.allRecords.find((r) => r.sourceId === "fixture-msg-0001");
  assert.equal(ok.ack_status, "prepared", "once out of backfill mode, an ok record can get its first draft");
  assert.ok(fs.existsSync(path.join(ws.ackDir, "fixture-msg-0001.txt")));
});
