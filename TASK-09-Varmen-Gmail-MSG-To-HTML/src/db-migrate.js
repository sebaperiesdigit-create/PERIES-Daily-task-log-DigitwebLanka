import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withVerifiedClient, closePool } from "./db.js";

// Stage 3 migration — ONE-TIME, MANUAL. NOT run automatically by anything
// (not scheduled, not called from run-live.js or any other script).
//
// Do NOT run (`node --env-file=.env src/db-migrate.js`) until:
//   1. sql/001_create_welfare_loan_requests.sql has been reviewed again,
//      verbatim, by the user.
//   2. The user has given the explicit "run the migration" go-ahead.
//   3. VARMEN_EXPECTED_DB / VARMEN_EXPECTED_USER are set in .env.
//
// The identity check inside withVerifiedClient() still aborts automatically
// if run against the wrong database/user even if this is invoked by
// mistake — but that check is a safety net, not a substitute for asking
// first. This script also refuses to proceed if the `welfare` schema
// doesn't already exist, rather than assuming the 2026-09-03 confirmation
// still holds.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(__dirname, "..", "sql", "001_create_welfare_loan_requests.sql");

async function schemaExists(client) {
  const result = await client.query(
    "SELECT 1 FROM information_schema.schemata WHERE schema_name = 'welfare';"
  );
  return result.rowCount > 0;
}

async function tableAlreadyExists(client) {
  const result = await client.query(
    "SELECT 1 FROM information_schema.tables WHERE table_schema = 'welfare' AND table_name = 'loan_requests';"
  );
  return result.rowCount > 0;
}

async function main() {
  const sql = fs.readFileSync(sqlPath, "utf8");
  console.log("About to run the following migration against Varmen DB:\n");
  console.log(sql);

  await withVerifiedClient(async (client) => {
    if (!(await schemaExists(client))) {
      throw new Error(
        "Schema 'welfare' does not exist in this database — aborting. The migration assumes it already exists; re-confirm with Varmen/IT before proceeding."
      );
    }
    if (await tableAlreadyExists(client)) {
      throw new Error("welfare.loan_requests already exists — aborting to avoid an accidental re-run.");
    }

    await client.query(sql);
    console.log("welfare.loan_requests created.");
  });

  await closePool();
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
