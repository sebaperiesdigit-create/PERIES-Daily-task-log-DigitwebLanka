import path from "node:path";
import { fileURLToPath } from "node:url";
import { runPipeline } from "./pipeline.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const { emails, parsed, allRecords } = runPipeline({
  fixturesDir: path.join(root, "fixtures", "emails"),
  storePath: path.join(root, "data", "store.json"),
  outputHtmlPath: path.join(root, "output", "loan-requests.html"),
  ackDir: path.join(root, "output", "acknowledgements"),
});

const ok = allRecords.filter((r) => r.parseStatus === "ok").length;
const review = allRecords.filter((r) => r.parseStatus === "needs_review").length;
const acked = allRecords.filter((r) => r.ack_status === "prepared").length;

console.log(`Loaded ${emails.length} fixture email(s).`);
console.log(`Qualifying: ${parsed.length} (skipped as ineligible: ${emails.length - parsed.length}).`);
console.log(`Store now has ${allRecords.length} record(s): ${ok} ok, ${review} needs_review.`);
console.log(`Acknowledgement drafts prepared (cumulative, draft-only, not sent): ${acked}.`);
console.log(`HTML written to output/loan-requests.html`);
