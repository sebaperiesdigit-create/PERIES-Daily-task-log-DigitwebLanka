import { google } from "googleapis";

// Shared, read-only Gmail API client builder. Used by both the one-time
// calibration script (src/gmail-calibrate.js) and the Stage 2 manual live
// fetch (src/gmail-fetch.js). Uses only the already-granted gmail.readonly
// scope's refresh token - never requests a broader scope, never writes
// credentials anywhere, never logs them.

export function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name} in .env. Run "node --env-file=.env src/gmail-auth.js" first.`);
  }
  return value;
}

export function buildGmailClient() {
  const clientId = requireEnv("GMAIL_CLIENT_ID");
  const clientSecret = requireEnv("GMAIL_CLIENT_SECRET");
  const refreshToken = requireEnv("GMAIL_REFRESH_TOKEN");

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: "v1", auth: oauth2Client });
}
