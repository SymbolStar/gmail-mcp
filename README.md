# @symbolstar/gmail-mcp

A Node.js/TypeScript MCP (Model Context Protocol) stdio server that lets AI assistants like **OpenClaw** read your Gmail via the Gmail API.

## Features

- OAuth 2.0 authorization with Gmail read-only scope
- `list_emails` — list inbox emails with optional filters
- `get_email` — read a single email by message ID
- `search_emails` — search with Gmail query syntax
- `list_labels` — list all Gmail labels/folders
- Works with any MCP-compatible client (OpenClaw, Claude Desktop, etc.)

---

## Quick Start

```bash
# Step 1: Authorize Gmail access (one-time setup)
npx @symbolstar/gmail-mcp auth

# Step 2: Done — the MCP server starts automatically when called by your client
```

---

## Setup Guide

### Step 1 — Create a Google Cloud Project & Enable Gmail API

1. Open [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Go to **APIs & Services → Library**
4. Search for **Gmail API** and click **Enable**

### Step 2 — Configure OAuth Consent Screen

1. Go to **APIs & Services → OAuth consent screen**
2. Under **Get started**, fill in:
   - **App name**: e.g. `Gmail MCP`
   - **User support email**: your Gmail address
3. Under **Audience**, select **External**
4. Under **Data Access**, add the scope:
   `https://www.googleapis.com/auth/gmail.readonly`
5. Under **Audience → Test users**, add your Gmail address
   > ⚠️ This step is required. Without it, you'll get `Error 403: access_denied` during authorization.

### Step 3 — Create OAuth Credentials

1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → OAuth client ID**
3. Application type: **Desktop app**
4. Name it anything (e.g. `gmail-mcp-cli`)
5. Click **Create**, then **Download JSON**

### Step 4 — Place credentials.json

```bash
mkdir -p ~/.gmail-mcp
chmod 700 ~/.gmail-mcp
cp ~/Downloads/client_secret_*.json ~/.gmail-mcp/credentials.json
chmod 600 ~/.gmail-mcp/credentials.json
```

The file must be at:
```
~/.gmail-mcp/credentials.json
```

### Step 5 — Run Authorization

```bash
npx @symbolstar/gmail-mcp auth
```

This will:
- Start a temporary local OAuth callback server
- Open your browser for Google authorization
- Save the token to `~/.gmail-mcp/token.json`

If the browser doesn't open automatically, copy the URL printed in the terminal and open it manually.

---

## Integrate with OpenClaw

Add the following to your `~/.openclaw/openclaw.json`:

```json
{
  "mcp": {
    "servers": {
      "gmail": {
        "command": "npx",
        "args": ["-y", "@symbolstar/gmail-mcp"]
      }
    }
  }
}
```

Then restart the gateway:

```bash
openclaw gateway restart
```

---

## Integrate with Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "gmail": {
      "command": "npx",
      "args": ["-y", "@symbolstar/gmail-mcp"]
    }
  }
}
```

---

## Available Tools

### `list_emails`

List inbox emails.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `maxResults` | number | 10 | Max emails to return (up to 50) |
| `query` | string | — | Gmail search query (applied within INBOX) |

### `get_email`

Read a single email by ID.

| Parameter | Type | Description |
|-----------|------|-------------|
| `messageId` | string | Gmail message ID |

Returns: sender, recipients, subject, date, labels, plain text body, HTML body, attachment metadata.

### `search_emails`

Search Gmail with full query syntax.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | — | Gmail search query (required) |
| `maxResults` | number | 10 | Max results (up to 50) |

### `list_labels`

List all Gmail labels and folders. No parameters required.

---

## File Locations

| File | Path |
|------|------|
| OAuth credentials | `~/.gmail-mcp/credentials.json` |
| OAuth token | `~/.gmail-mcp/token.json` |

---

## Troubleshooting

### `Missing Gmail OAuth credentials`
Make sure you downloaded the OAuth client JSON and placed it at `~/.gmail-mcp/credentials.json`.

### `Missing Gmail OAuth token`
Run the authorization flow first:
```bash
npx @symbolstar/gmail-mcp auth
```

### `Error 403: access_denied`
Your Gmail account is not added as a Test user. Go to **Google Cloud Console → OAuth consent screen → Audience → Test users** and add your Gmail address.

### `invalid_grant`
Token expired or revoked. Delete it and re-authorize:
```bash
rm ~/.gmail-mcp/token.json
npx @symbolstar/gmail-mcp auth
```

---

## Requirements

- Node.js 18+
- A Google account with Gmail

## License

MIT
