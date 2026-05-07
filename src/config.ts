import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { google } from "googleapis";

type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

export const APP_DIR = path.join(os.homedir(), ".gmail-mcp");
export const CREDENTIALS_PATH = path.join(APP_DIR, "credentials.json");
export const TOKEN_PATH = path.join(APP_DIR, "token.json");

export const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

type OAuthClientConfig = {
  client_id: string;
  client_secret: string;
  redirect_uris?: string[];
};

type CredentialsFile = {
  installed?: OAuthClientConfig;
  web?: OAuthClientConfig;
};

export async function ensureAppDir(): Promise<void> {
  await fs.mkdir(APP_DIR, { recursive: true, mode: 0o700 });
}

export async function loadCredentials(): Promise<OAuthClientConfig> {
  let raw: string;

  try {
    raw = await fs.readFile(CREDENTIALS_PATH, "utf8");
  } catch (error) {
    throw new Error(
      `Missing Gmail OAuth credentials. Place credentials.json at ${CREDENTIALS_PATH}.`,
      { cause: error },
    );
  }

  const credentials = JSON.parse(raw) as CredentialsFile;
  const clientConfig = credentials.installed ?? credentials.web;

  if (!clientConfig?.client_id || !clientConfig.client_secret) {
    throw new Error(`Invalid OAuth credentials file at ${CREDENTIALS_PATH}.`);
  }

  return clientConfig;
}

export function createOAuthClient(
  clientConfig: OAuthClientConfig,
  redirectUri?: string,
): OAuth2Client {
  const resolvedRedirectUri =
    redirectUri ?? clientConfig.redirect_uris?.[0] ?? "http://localhost";

  return new google.auth.OAuth2(
    clientConfig.client_id,
    clientConfig.client_secret,
    resolvedRedirectUri,
  );
}

export async function loadAuthorizedClient(): Promise<OAuth2Client> {
  const clientConfig = await loadCredentials();
  const auth = createOAuthClient(clientConfig);

  let raw: string;
  try {
    raw = await fs.readFile(TOKEN_PATH, "utf8");
  } catch (error) {
    throw new Error(`Missing Gmail OAuth token. Run npm run auth first.`, {
      cause: error,
    });
  }

  auth.setCredentials(JSON.parse(raw));
  return auth;
}
