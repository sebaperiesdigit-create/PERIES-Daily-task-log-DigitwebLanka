import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";

// One-time, manually-run CLI helper (Stage 1 of the live rollout plan).
//
// Run this yourself with `npm run gmail:auth` (loads .env via --env-file).
// It prints a Google consent URL for YOU to open in YOUR OWN browser and
// approve as welfaredw@gmail.com (must be added as a Test user first, or the
// app must be verified). This script never prints, logs, or sends the
// resulting refresh token anywhere except your local .env file.
//
// Read-only scope only (gmail.readonly) - matches the confirmed least-privilege
// decision. See docs/README.md and the approved plan for the full context.

const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const REDIRECT_PORT = 8085;
const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}`;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name} in .env - set it (from Google Cloud Console -> Clients) before running this script.`);
    process.exit(1);
  }
  return value;
}

/** Writes/updates one KEY=value line in .env without touching or printing any other value. */
function upsertEnvVar(key, value) {
  let contents = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(contents)) {
    contents = contents.replace(pattern, line);
  } else {
    if (contents.length > 0 && !contents.endsWith("\n")) contents += "\n";
    contents += `${line}\n`;
  }
  fs.writeFileSync(envPath, contents, "utf8");
}

async function main() {
  const clientId = requireEnv("GMAIL_CLIENT_ID");
  const clientSecret = requireEnv("GMAIL_CLIENT_SECRET");

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline", // required to receive a refresh token
    prompt: "consent", // forces the consent screen so a refresh token is always issued
    scope: [SCOPE],
  });

  console.log("\n1. Open this URL in your own browser and sign in as welfaredw@gmail.com:\n");
  console.log(authUrl);
  console.log("\n2. Approve access. Your browser will redirect to a local address - that's expected, come back here.\n");
  console.log("Waiting for authorization...");

  const code = await waitForAuthorizationCode();

  const { tokens } = await oauth2Client.getToken(code);
  if (!tokens.refresh_token) {
    console.error(
      "\nNo refresh token was returned. This usually means access was already granted before " +
        "without 'prompt=consent'. In Google Account settings, remove this app's access " +
        "(myaccount.google.com/permissions) and run this script again.\n"
    );
    process.exit(1);
  }

  upsertEnvVar("GMAIL_REFRESH_TOKEN", tokens.refresh_token);
  console.log("\n✅ Authorization complete. GMAIL_REFRESH_TOKEN saved to .env.");
  console.log("(The token value itself was never printed here or anywhere else.)\n");
}

/** Starts a one-shot local server on 127.0.0.1:REDIRECT_PORT to capture the OAuth redirect's `code` param. */
function waitForAuthorizationCode() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, REDIRECT_URI);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error) {
        res.end("Authorization failed. You can close this tab and check the terminal.");
        server.close();
        reject(new Error(`Google returned an error: ${error}`));
        return;
      }
      if (code) {
        res.end("Authorization received. You can close this tab and return to the terminal.");
        server.close();
        resolve(code);
      }
    });
    server.listen(REDIRECT_PORT, "127.0.0.1");
  });
}

main().catch((err) => {
  console.error("\nAuthorization failed:", err.message);
  process.exit(1);
});
