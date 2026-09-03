// Pure, network-free mapping from a raw Gmail API message resource to the
// { id, threadId, from, subject, receivedAt, bodyText } shape parseEmail()
// already consumes (the same shape fixtures/emails/*.json use). Shared by
// src/gmail-calibrate.js (Stage 1) and src/gmail-fetch.js (Stage 2) so the
// decoding logic exists in exactly one place.

const SRI_LANKA_OFFSET_MINUTES = 5.5 * 60; // +05:30, no daylight saving

function decodeBase64Url(data) {
  return Buffer.from(data, "base64url").toString("utf8");
}

/** Recursively finds the first text/plain part; falls back to text/html if none. */
function findBody(payload) {
  if (!payload) return { text: null, mimeType: null };
  if (payload.body?.data && (payload.mimeType === "text/plain" || !payload.parts)) {
    return { text: decodeBase64Url(payload.body.data), mimeType: payload.mimeType };
  }
  if (payload.parts) {
    const plain = payload.parts.find((p) => p.mimeType === "text/plain" && p.body?.data);
    if (plain) return { text: decodeBase64Url(plain.body.data), mimeType: "text/plain" };
    for (const part of payload.parts) {
      const found = findBody(part);
      if (found.text) return found;
    }
  }
  return { text: null, mimeType: null };
}

function header(headers, name) {
  return (headers ?? []).find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? null;
}

/**
 * Formats an epoch-ms timestamp as an ISO-8601 string with a fixed +05:30
 * (Sri Lanka) offset, matching the fixtures' format. Gmail's `internalDate`
 * is always a UTC epoch value; converting via plain `.toISOString()` would
 * give the UTC calendar date, which can be a day off from the Sri Lanka
 * calendar date near midnight - and "Date" is confirmed to mean the Gmail
 * received date as the business (Sri Lanka-based) would read it.
 */
function toSriLankaIsoString(epochMs) {
  const local = new Date(epochMs + SRI_LANKA_OFFSET_MINUTES * 60 * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  const y = local.getUTCFullYear();
  const mo = pad(local.getUTCMonth() + 1);
  const d = pad(local.getUTCDate());
  const h = pad(local.getUTCHours());
  const mi = pad(local.getUTCMinutes());
  const s = pad(local.getUTCSeconds());
  return `${y}-${mo}-${d}T${h}:${mi}:${s}+05:30`;
}

/** Maps one Gmail API message resource (format: "full") to the internal email shape. */
export function mapGmailMessage(message) {
  const headers = message.payload?.headers ?? [];
  const { text: bodyText } = findBody(message.payload);

  return {
    id: message.id,
    threadId: message.threadId,
    from: header(headers, "From"),
    subject: header(headers, "Subject"),
    receivedAt: toSriLankaIsoString(Number(message.internalDate)),
    bodyText: bodyText ?? "",
  };
}
