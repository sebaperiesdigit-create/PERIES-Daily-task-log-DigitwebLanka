import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withVerifiedClient, closePool } from "./db.js";

// Stage 3, v9 migration — ONE-TIME, MANUAL. NOT run automatically by
// anything (not scheduled, not called from run-live.js or any other
// script).
//
// Do NOT run (`node --env-file=.env src/db-migrate-002.js`) until:
//   1. sql/002_add_v9_columns.sql has been reviewed again, verbatim, by
//      the user.
//   2. The user has given the explicit "run the migration" go-ahead.
//   3. VARMEN_EXPECTED_DB / VARMEN_EXPECTED_USER are set in .env.
//
// The identity check inside withVerifiedClient() still aborts automatically
// if run against the wrong database/user even if this is invoked by
// mistake — but that check is a safety net, not a substitute for asking
// first.
//
// Unlike db-migrate.js (which checks whether the whole TABLE already
// exists), this checks whether any of the 4 target COLUMNS already exist —
// the correct idempotency guard for an ALTER TABLE ... ADD COLUMN, so an
// accidental re-run is refused without needing to touch the table itself.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(__dirname, "..", "sql", "002_add_v9_columns.sql");

const NEW_COLUMNS = ["loan_type_source", "discrepancy_note", "staff_confirmed_from_message_id", "staff_confirmed_at"];

async function existingNewColumns(client) {
  const result = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'welfare' AND table_name = 'loan_requests' AND column_name = ANY($1);`,
    [NEW_COLUMNS]
  );
  return result.rows.map((r) => r.column_name);
}

async function main() {
  const sql = fs.readFileSync(sqlPath, "utf8");
  console.log("About to run the following migration against Varmen DB:\n");
  console.log(sql);

  await withVerifiedClient(async (client) => {
    const already = await existingNewColumns(client);
    if (already.length > 0) {
      throw new Error(`Column(s) already exist, aborting to avoid an accidental re-run: ${already.join(", ")}`);
    }

    await client.query(sql);
    console.log("welfare.loan_requests: 4 new v9 columns added.");
  });

  await closePool();
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
