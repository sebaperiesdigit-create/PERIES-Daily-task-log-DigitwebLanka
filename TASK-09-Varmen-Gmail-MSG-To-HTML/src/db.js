import pg from "pg";

// Stage 3 (Varmen DB) — CONFIRMED-only scaffolding. See the approved plan at
// C:\Users\LED 269\.claude\plans\flickering-beaming-brooks.md and
// docs/HANDOVER.md for the full decision trail. Nothing in the live
// pipeline (src/pipeline.js, src/run-live.js) imports this file yet — it is
// wired in only once Stage 3 is separately, explicitly approved to run.
//
// Connection info comes entirely from .env (VARMEN_DB_*) — never
// hard-coded, never printed/logged. VARMEN_EXPECTED_DB / VARMEN_EXPECTED_USER
// are DELIBERATELY separate from the connection params: a correct
// connection to the wrong database/user (e.g. a shared host, a valid but
// mistaken db name) would otherwise succeed silently. This module never
// prints the actual query result — only a pass/fail signal.

const { Pool } = pg;

let pool = null;

const REQUIRED_CONNECTION_VARS = [
  "VARMEN_DB_HOST",
  "VARMEN_DB_PORT",
  "VARMEN_DB_NAME",
  "VARMEN_DB_USER",
  "VARMEN_DB_PASSWORD",
];

/** Lazily creates a single shared connection pool from .env VARMEN_DB_* vars. */
function getPool() {
  if (pool) return pool;
  for (const key of REQUIRED_CONNECTION_VARS) {
    if (!process.env[key]) {
      throw new Error(`Missing required env var ${key} — see .env.example`);
    }
  }
  pool = new Pool({
    host: process.env.VARMEN_DB_HOST,
    port: Number(process.env.VARMEN_DB_PORT),
    database: process.env.VARMEN_DB_NAME,
    user: process.env.VARMEN_DB_USER,
    password: process.env.VARMEN_DB_PASSWORD,
    // 2026-09-04: the server rejected an unencrypted connection
    // ("no pg_hba.conf entry ... no encryption"). rejectUnauthorized: false
    // accepts the server's certificate without verifying its chain — common
    // for a managed/self-signed Postgres host. Connection is still
    // encrypted in transit; this only skips certificate verification.
    ssl: { rejectUnauthorized: false },
  });
  return pool;
}

/**
 * Mandatory identity gate (CONFIRMED 2026-09-03 plan) — must be called
 * before EVERY write, not just once at startup. Runs
 * `SELECT current_database(), current_user;` INTERNALLY ONLY: the raw
 * result never leaves this function (not returned, printed, or logged) —
 * callers only ever see a boolean. Missing either expected env var is
 * treated as a FAIL, never skipped or defaulted.
 */
export async function verifyIdentity(client) {
  const expectedDb = process.env.VARMEN_EXPECTED_DB;
  const expectedUser = process.env.VARMEN_EXPECTED_USER;
  if (!expectedDb || !expectedUser) {
    console.error("❌ identity check failed — VARMEN_EXPECTED_DB/VARMEN_EXPECTED_USER not set in .env");
    return false;
  }

  const result = await client.query("SELECT current_database() AS db, current_user AS usr;");
  const { db, usr } = result.rows[0]; // never printed/logged/returned beyond this function

  const passed = db === expectedDb && usr === expectedUser;
  console.log(passed ? "✅ identity check passed" : "❌ identity check failed — aborting");
  return passed;
}

/**
 * Runs `fn(client)` inside a checked-out connection, ONLY after
 * verifyIdentity() passes. Every write path (src/pg-store.js, not yet
 * built) must go through this — never acquire a client and skip the check,
 * even for a single call.
 */
export async function withVerifiedClient(fn) {
  const client = await getPool().connect();
  try {
    const ok = await verifyIdentity(client);
    if (!ok) throw new Error("Varmen DB identity check failed — aborting before any write");
    return await fn(client);
  } finally {
    client.release();
  }
}

/** Closes the pool — call once at process exit (e.g. end of a one-time script). */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
