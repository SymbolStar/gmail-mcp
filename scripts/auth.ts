#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs/promises";
import { AddressInfo } from "node:net";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  APP_DIR,
  GMAIL_SCOPES,
  TOKEN_PATH,
  createOAuthClient,
  ensureAppDir,
  loadCredentials,
} from "../src/config.js";

const execFileAsync = promisify(execFile);

async function main(): Promise<void> {
  await ensureAppDir();

  const server = http.createServer();
  const codePromise = waitForOAuthCode(server);

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;

  const credentials = await loadCredentials();
  const auth = createOAuthClient(credentials, redirectUri);
  const authUrl = auth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GMAIL_SCOPES,
  });

  console.log("Open this URL to authorize Gmail MCP:");
  console.log(authUrl);
  await openBrowser(authUrl);

  const code = await codePromise;
  const { tokens } = await auth.getToken(code);

  await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2), { mode: 0o600 });
  await fs.chmod(APP_DIR, 0o700);

  console.log(`Token saved to ${TOKEN_PATH}`);
}

function waitForOAuthCode(server: http.Server): Promise<string> {
  return new Promise((resolve, reject) => {
    server.on("request", (req, res) => {
      try {
        const url = new URL(req.url ?? "/", "http://127.0.0.1");

        if (url.pathname !== "/oauth2callback") {
          res.writeHead(404);
          res.end("Not found");
          return;
        }

        const error = url.searchParams.get("error");
        if (error) {
          res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
          res.end(`Authorization failed: ${error}`);
          reject(new Error(`Authorization failed: ${error}`));
          server.close();
          return;
        }

        const code = url.searchParams.get("code");
        if (!code) {
          res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
          res.end("Missing authorization code.");
          reject(new Error("Missing authorization code."));
          server.close();
          return;
        }

        res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
        res.end("Gmail MCP authorization complete. You can close this page.");
        resolve(code);
        server.close();
      } catch (error) {
        reject(error);
        server.close();
      }
    });

    server.on("error", reject);
  });
}

async function openBrowser(url: string): Promise<void> {
  const platform = process.platform;
  const command =
    platform === "darwin" ? "open" : platform === "win32" ? "cmd" : "xdg-open";
  const args = platform === "win32" ? ["/c", "start", "", url] : [url];

  try {
    await execFileAsync(command, args);
  } catch {
    // The printed URL is enough for headless or minimal environments.
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

