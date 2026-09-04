import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchQualifyingEmails } from "./gmail-fetch.js";
import { runPipeline } from "./pipeline.js";
import { PgStore } from "./pg-store.js";

// Stage 2 of the live rollout plan: a DELIBERATE, MANUAL command only.
// Not scheduled, not run automatically by anything. Run yourself with
// `npm run gmail:live` (or `node --env-file=.env src/run-live.js`) whenever
// you explicitly want to pull current real mail.
//
// Read-only Gmail access only. No email sent - acknowledgement "sending"
// does not exist anywhere in this codebase yet (Stage 5, separately
// approved, later). All output goes to gitignored output/live/ + data/live/
// paths - the committed demo files built from fixtures/emails/*.json are
// never touched by this script.
//
// Varmen DB mirror (Stage 3, added 2026-09-04): OFF BY DEFAULT. Only
// mirrors records into welfare.loan_requests, in parallel with the JSON
// store, when VARMEN_DB_MIRROR=true is explicitly set in .env - a plain
// `run-live.js` invocation still touches ONLY the JSON store and Gmail,
// exactly as before, until that flag is turned on with its own separate
// go-ahead.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const liveStorePath = path.join(root, "data", "live", "store.json");
const liveHtmlPath = path.join(root, "output", "live", "loan-requests.html");
const liveAckDir = path.join(root, "output", "live", "acknowledgements");
// Optional, hand-edited by a reviewer - see src/pipeline.js `applyManualCorrections`.
// Not created by this script; simply ignored if it doesn't exist.
const liveCorrectionsPath = path.join(root, "data", "live", "corrections.json");

async function main() {
  // STRICT backfill detection: if no live store exists yet, this is the
  // first-ever live run - by definition it pulls in everything currently
  // sitting in the mailbox (up to the fetch window), which is a historical
  // import, not "new" activity. Historical imports must never draft
  // acknowledgements - see src/pipeline.js `backfillMode`. This is automatic,
  // not a flag someone has to remember to pass.
  const backfillMode = !fs.existsSync(liveStorePath);
  console.log(
    backfillMode
      ? "No existing live store found - treating this as a HISTORICAL BACKFILL run. No acknowledgement drafts will be created, even for otherwise-complete requests."
      : "Existing live store found - treating this as a normal run. New complete requests may get an acknowledgement draft."
  );

  console.log("Searching the live mailbox for subject-matching messages (read-only)...");
  const emails = await fetchQualifyingEmails();
  console.log(
    `Fetched ${emails.length} subject-matching message(s) (includes replies, which the pipeline still ` +
      `excludes below - only fresh initial requests actually qualify). Nothing printed beyond counts from here.`
  );

  const dbMirrorEnabled = process.env.VARMEN_DB_MIRROR === "true";
  console.log(
    dbMirrorEnabled
      ? "VARMEN_DB_MIRROR=true - records will ALSO be mirrored into welfare.loan_requests (parallel, best-effort)."
      : "Varmen DB mirror is OFF (VARMEN_DB_MIRROR not set to \"true\") - JSON store only, as before."
  );

  const { allRecords, dbMirrorPromise } = runPipeline({
    emails,
    storePath: liveStorePath,
    outputHtmlPath: liveHtmlPath,
    ackDir: liveAckDir,
    backfillMode,
    correctionsPath: liveCorrectionsPath,
    pgStore: dbMirrorEnabled ? new PgStore() : undefined,
  });

  const ok = allRecords.filter((r) => r.parseStatus === "ok").length;
  const review = allRecords.filter((r) => r.parseStatus === "needs_review").length;
  const acked = allRecords.filter((r) => r.ack_status === "prepared").length;

  console.log(`Store now has ${allRecords.length} record(s): ${ok} ok, ${review} needs_review.`);
  console.log(`Acknowledgement drafts prepared (cumulative, draft-only, NOT sent): ${acked}.`);
  console.log("HTML written to output/live/loan-requests.html");

  if (dbMirrorPromise) {
    await dbMirrorPromise; // wait for the mirror so failures are visible before the process exits
    console.log("Varmen DB mirror finished (see above for success/failure).");
  }
}

main().catch((err) => {
  console.error("Live fetch failed:", err.message);
  process.exit(1);
});
