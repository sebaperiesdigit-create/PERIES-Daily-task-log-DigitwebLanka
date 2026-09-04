import { withVerifiedClient, closePool } from "./db.js";

// Stage 3 — read-only preliminary check (2026-09-04). ONE-TIME, MANUAL.
// Runs the identity gate + confirms the `welfare` schema still exists and
// `welfare.loan_requests` doesn't already exist. NO writes, NO DDL — this
// is deliberately separate from src/db-migrate.js so the identity/schema
// check can be approved and run on its own, ahead of the actual migration.

async function main() {
  await withVerifiedClient(async (client) => {
    const schema = await client.query(
      "SELECT 1 FROM information_schema.schemata WHERE schema_name = 'welfare';"
    );
    console.log(schema.rowCount > 0 ? "✅ schema 'welfare' exists" : "❌ schema 'welfare' does NOT exist");

    const table = await client.query(
      "SELECT 1 FROM information_schema.tables WHERE table_schema = 'welfare' AND table_name = 'loan_requests';"
    );
    console.log(
      table.rowCount > 0
        ? "⚠️ welfare.loan_requests ALREADY EXISTS"
        : "✅ welfare.loan_requests does not exist yet (safe to create)"
    );
  });

  await closePool();
}

main().catch((err) => {
  console.error("Check failed:", err.message);
  process.exit(1);
});
