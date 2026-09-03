import fs from "node:fs";
import path from "node:path";

/**
 * Draft-only, local-only acknowledgement-reply preparation.
 *
 * This module NEVER connects to Gmail and NEVER sends anything. It only
 * decides whether a record is due a first-time acknowledgement draft and, if
 * so, writes a plain-text draft file plus private tracking fields onto the
 * record. See src/config.js "acknowledgement" for the (confirmed 2026-09-03)
 * sender identity and wording, and docs/README.md for the full set of
 * decisions this was built against.
 */

function sanitizeForFilename(sourceId) {
  return String(sourceId).replace(/[^A-Za-z0-9_.-]/g, "_");
}

function buildAckDraftId(sourceId) {
  return `ack-${sourceId}`;
}

/** Renders the human-readable draft text written to output/acknowledgements/<id>.txt. */
export function renderAckDraftText(record, config) {
  const ack = config.acknowledgement;
  const body = ack.renderBody(record);
  return [
    "*** DRAFT ACKNOWLEDGEMENT - NOT SENT ***",
    "*** Sender and wording approved 2026-09-03. Still not sent: live Gmail sending is not activated. ***",
    "",
    `To: ${record.fromAddress ?? ""}`,
    `From: ${ack.fromDisplayName} <${ack.fromAddress}>`,
    `Thread ID: ${record.threadId ?? ""}`,
    `In reply to (source message ID): ${record.sourceId}`,
    `Subject: ${ack.subjectPrefix}${record.subject ?? ""}`,
    "",
    body,
    "",
  ].join("\n");
}

/**
 * Prepares (and persists to disk) an acknowledgement draft for `record` if,
 * and only if, it is due one for the first time.
 *
 * Idempotent by sourceId: if `record.ack_status` is already "prepared" (i.e.
 * a prior pipeline run already prepared it), this returns the record
 * unchanged - no second file, no altered fields. Never called for anything
 * but a fully-extracted parseStatus "ok" record (enforced by the pipeline,
 * and defensively re-checked here).
 *
 * Returns a new record object; never mutates the input.
 */
export function prepareAcknowledgementIfNeeded({ record, config, ackDir, now }) {
  if (record.parseStatus !== "ok") return record;
  if (record.ack_status === "prepared") return record;

  const draftId = buildAckDraftId(record.sourceId);
  const text = renderAckDraftText(record, config);

  fs.mkdirSync(ackDir, { recursive: true });
  fs.writeFileSync(path.join(ackDir, `${sanitizeForFilename(record.sourceId)}.txt`), text, "utf8");

  return {
    ...record,
    ack_status: "prepared",
    ack_source_message_id: record.sourceId,
    ack_thread_id: record.threadId ?? null,
    ack_recipient: record.fromAddress ?? null,
    ack_draft_id: draftId,
    ack_template_version: config.acknowledgement.templateVersion,
    ack_prepared_at: (now ?? new Date()).toISOString(),
  };
}
