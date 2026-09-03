import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { mapGmailMessage } from "../src/gmail-message-mapper.js";
import { runPipeline } from "../src/pipeline.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "..", "fixtures", "emails");

function base64url(str) {
  return Buffer.from(str, "utf8").toString("base64url");
}

// --- Gmail-message mapping (synthetic Gmail API response shapes only) -----------

test("mapGmailMessage extracts id/threadId/from/subject/receivedAt/bodyText from a synthetic single-part message", () => {
  const syntheticMessage = {
    id: "synthetic-msg-1",
    threadId: "synthetic-thread-1",
    internalDate: "1755673440000", // arbitrary epoch ms - only round-trip is asserted
    payload: {
      mimeType: "text/plain",
      headers: [
        { name: "From", value: "Synthetic Sender <synthetic.sender@example-welfare.test>" },
        { name: "Subject", value: "Personal Loan Request" },
      ],
      body: {
        data: base64url(
          "Dear Welfare Team,\r\n\r\nI would like to request LKR 10,000 due to a synthetic reason.\r\n\r\nKind regards,\r\nSynthetic Sender\r\n"
        ),
      },
    },
  };

  const email = mapGmailMessage(syntheticMessage);
  assert.equal(email.id, "synthetic-msg-1");
  assert.equal(email.threadId, "synthetic-thread-1");
  assert.equal(email.from, "Synthetic Sender <synthetic.sender@example-welfare.test>");
  assert.equal(email.subject, "Personal Loan Request");
  assert.match(email.bodyText, /LKR 10,000/);
  assert.match(email.bodyText, /Synthetic Sender/);
});

test("mapGmailMessage's receivedAt round-trips to the same instant, formatted with a +05:30 offset", () => {
  const epochMs = 1755673440000;
  const syntheticMessage = {
    id: "synthetic-msg-tz",
    threadId: "synthetic-msg-tz",
    internalDate: String(epochMs),
    payload: {
      mimeType: "text/plain",
      headers: [{ name: "Subject", value: "Loan Request" }],
      body: { data: base64url("Loan request due to timezone test.") },
    },
  };

  const email = mapGmailMessage(syntheticMessage);
  assert.match(email.receivedAt, /\+05:30$/, "must be formatted in Sri Lanka local time, not raw UTC");
  assert.equal(new Date(email.receivedAt).getTime(), epochMs, "must represent the same instant as internalDate");
});

test("mapGmailMessage finds the text/plain part inside a multipart/alternative payload", () => {
  const syntheticMessage = {
    id: "synthetic-msg-2",
    threadId: "synthetic-msg-2",
    internalDate: "1755759840000",
    payload: {
      mimeType: "multipart/alternative",
      headers: [
        { name: "From", value: "Another Sender <another@example-welfare.test>" },
        { name: "Subject", value: "Loan Request" },
      ],
      parts: [
        { mimeType: "text/plain", body: { data: base64url("Plain text version: requesting a loan due to testing.") } },
        { mimeType: "text/html", body: { data: base64url("<p>HTML version, should not be used</p>") } },
      ],
    },
  };

  const email = mapGmailMessage(syntheticMessage);
  assert.match(email.bodyText, /Plain text version/);
  assert.doesNotMatch(email.bodyText, /<p>/);
});

test("mapGmailMessage returns null fields gracefully when headers/body are missing (never throws)", () => {
  const syntheticMessage = {
    id: "synthetic-msg-empty",
    threadId: "synthetic-msg-empty",
    internalDate: "1755673440000",
    payload: {},
  };
  const email = mapGmailMessage(syntheticMessage);
  assert.equal(email.from, null);
  assert.equal(email.subject, null);
  assert.equal(email.bodyText, "");
});

// --- Live vs demo output isolation (synthetic email, no real Gmail call) --------

test("live-output paths are fully isolated from the committed demo/fixture output paths", () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "task09-live-isolation-"));
  const demoStorePath = path.join(baseDir, "data", "store.json");
  const demoHtmlPath = path.join(baseDir, "output", "loan-requests.html");
  const demoAckDir = path.join(baseDir, "output", "acknowledgements");

  const liveStorePath = path.join(baseDir, "data", "live", "store.json");
  const liveHtmlPath = path.join(baseDir, "output", "live", "loan-requests.html");
  const liveAckDir = path.join(baseDir, "output", "live", "acknowledgements");

  const syntheticLiveEmail = {
    id: "live-synthetic-1",
    threadId: "live-synthetic-1",
    from: "Live Synthetic <live.synthetic@example-welfare.test>",
    subject: "Personal Loan Request",
    receivedAt: "2026-08-20T09:00:00+05:30",
    bodyText:
      "Dear Welfare Team,\r\n\r\nI would like to request LKR 15,000 due to a synthetic live test.\r\n\r\nKind regards,\r\nLive Synthetic\r\n",
  };

  // Demo pipeline: real fixtures, demo paths - unchanged behavior.
  runPipeline({ fixturesDir, storePath: demoStorePath, outputHtmlPath: demoHtmlPath, ackDir: demoAckDir });

  // "Live" pipeline: a synthetic email (standing in for a real Gmail fetch),
  // live paths only. No network call happens here.
  runPipeline({ emails: [syntheticLiveEmail], storePath: liveStorePath, outputHtmlPath: liveHtmlPath, ackDir: liveAckDir });

  assert.ok(fs.existsSync(demoStorePath));
  assert.ok(fs.existsSync(liveStorePath));
  assert.notEqual(demoStorePath, liveStorePath);

  const demoStore = JSON.parse(fs.readFileSync(demoStorePath, "utf8"));
  const liveStore = JSON.parse(fs.readFileSync(liveStorePath, "utf8"));

  // The live-only synthetic record must never appear in the demo store, and
  // the demo fixture records must never appear in the live store.
  assert.equal(Object.hasOwn(demoStore, "live-synthetic-1"), false);
  assert.equal(Object.hasOwn(liveStore, "live-synthetic-1"), true);
  assert.equal(Object.hasOwn(liveStore, "fixture-msg-0001"), false);

  const demoHtml = fs.readFileSync(demoHtmlPath, "utf8");
  const liveHtml = fs.readFileSync(liveHtmlPath, "utf8");
  assert.doesNotMatch(demoHtml, /Live Synthetic/);
  assert.match(liveHtml, /Live Synthetic/);

  // Acknowledgement drafts are isolated the same way.
  assert.equal(fs.existsSync(path.join(demoAckDir, "live-synthetic-1.txt")), false);
  assert.equal(fs.existsSync(path.join(liveAckDir, "live-synthetic-1.txt")), true);
});

test("a synthetic live email that needs review never produces an acknowledgement, same as the demo pipeline", () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "task09-live-review-"));
  const liveStorePath = path.join(baseDir, "data", "live", "store.json");
  const liveHtmlPath = path.join(baseDir, "output", "live", "loan-requests.html");
  const liveAckDir = path.join(baseDir, "output", "live", "acknowledgements");

  const syntheticIncompleteEmail = {
    id: "live-synthetic-2",
    threadId: "live-synthetic-2",
    from: "Live Synthetic B <live.synthetic.b@example-welfare.test>",
    subject: "Personal Loan Request",
    receivedAt: "2026-08-21T09:00:00+05:30",
    bodyText: "Dear Welfare Team,\r\n\r\nI would like to request a loan due to urgent needs.\r\n\r\nKind regards,\r\nLive Synthetic B\r\n",
  };

  const { allRecords } = runPipeline({
    emails: [syntheticIncompleteEmail],
    storePath: liveStorePath,
    outputHtmlPath: liveHtmlPath,
    ackDir: liveAckDir,
  });

  const record = allRecords.find((r) => r.sourceId === "live-synthetic-2");
  assert.equal(record.parseStatus, "needs_review");
  assert.equal(record.ack_status, undefined);
  assert.equal(fs.existsSync(path.join(liveAckDir, "live-synthetic-2.txt")), false);
});
