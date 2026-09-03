import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildGmailClient } from "./gmail-client.js";
import { mapGmailMessage } from "./gmail-message-mapper.js";

// One-time, manually-run calibration fetch (Stage 1 of the live rollout plan).
//
// Run with `node --env-file=.env src/gmail-calibrate.js` AFTER `gmail-auth.js`
// has saved GMAIL_REFRESH_TOKEN.
//
// Fetches a SMALL number of messages using the ALREADY-CONFIRMED qualifying
// rule (subject contains "loan" AND "request" - see config.js isQualifying),
// translated into a Gmail search query. This deliberately does NOT use a
// broader/looser heuristic, to avoid reading mailbox content beyond what the
// live system will actually process.
//
// Safety, per the approved plan:
//   - Read-only. No labels/messages are modified.
//   - Output goes ONLY to data/calibration/ (gitignored, restrictive file
//     permissions attempted), never printed to this script's own console
//     output, never sent anywhere.
//   - The user reviews the saved files themselves, locally, and reports back
//     (redacted as needed) what pattern to encode in config.js.
//   - Delete data/calibration/ once done - see docs/README.md.

const QUALIFYING_QUERY = "subject:loan subject:request"; // mirrors config.js isQualifying
const MAX_RESULTS = 5;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "data", "calibration");

async function main() {
  const gmail = buildGmailClient();

  console.log(`Searching welfaredw@gmail.com for: ${QUALIFYING_QUERY}`);
  const listResp = await gmail.users.messages.list({
    userId: "me",
    q: QUALIFYING_QUERY,
    maxResults: MAX_RESULTS,
  });

  const messages = listResp.data.messages ?? [];
  if (messages.length === 0) {
    console.log("No matching messages found. Nothing to save.");
    return;
  }

  fs.mkdirSync(outDir, { recursive: true });
  try {
    fs.chmodSync(outDir, 0o700); // best-effort; Windows doesn't enforce POSIX permissions the same way
  } catch {
    // non-fatal - documented limitation, see docs/README.md
  }

  let saved = 0;
  for (const { id } of messages) {
    const msg = await gmail.users.messages.get({ userId: "me", id, format: "full" });
    const record = mapGmailMessage(msg.data);

    const filePath = path.join(outDir, `${record.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2), "utf8");
    try {
      fs.chmodSync(filePath, 0o600);
    } catch {
      // non-fatal - see docs/README.md
    }
    saved += 1;
  }

  console.log(`\nSaved ${saved} message(s) to data/calibration/ for your own local review.`);
  console.log("Nothing was printed here, logged, or sent anywhere else.");
  console.log("Once you've reviewed them and confirmed the real format, delete this folder:");
  console.log("  rm -rf data/calibration/   (or delete it manually in File Explorer)\n");
}

main().catch((err) => {
  console.error("Calibration fetch failed:", err.message);
  process.exit(1);
});
