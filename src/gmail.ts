import fs from "node:fs/promises";
import { google, gmail_v1 } from "googleapis";
import { loadAuthorizedClient, TOKEN_PATH } from "./config.js";

const USER_ID = "me";

export type EmailSummary = {
  id: string;
  threadId?: string | null;
  snippet?: string | null;
  from?: string;
  to?: string;
  subject?: string;
  date?: string;
  labels?: string[] | null;
};

export type EmailDetail = EmailSummary & {
  cc?: string;
  bcc?: string;
  bodyText?: string;
  bodyHtml?: string;
  attachments: Array<{
    filename: string;
    mimeType?: string | null;
    attachmentId?: string;
    size?: number | null;
  }>;
  internalDate?: string | null;
};

export type GmailLabel = {
  id?: string | null;
  name?: string | null;
  type?: string | null;
  messageListVisibility?: string | null;
  labelListVisibility?: string | null;
};

let gmailClientPromise: Promise<gmail_v1.Gmail> | undefined;

async function getGmailClient(): Promise<gmail_v1.Gmail> {
  gmailClientPromise ??= (async () => {
    const auth = await loadAuthorizedClient();

    auth.on("tokens", async (tokens) => {
      if (!tokens.access_token && !tokens.refresh_token) {
        return;
      }

      const currentRaw = await fs.readFile(TOKEN_PATH, "utf8");
      const current = JSON.parse(currentRaw) as Record<string, unknown>;
      await fs.writeFile(
        TOKEN_PATH,
        JSON.stringify({ ...current, ...tokens }, null, 2),
        { mode: 0o600 },
      );
    });

    return google.gmail({ version: "v1", auth });
  })();

  return gmailClientPromise;
}

export async function listInboxEmails(options: {
  maxResults?: number;
  query?: string;
}): Promise<EmailSummary[]> {
  return listEmails({ ...options, inboxOnly: true });
}

export async function searchEmails(options: {
  maxResults?: number;
  query: string;
}): Promise<EmailSummary[]> {
  return listEmails({ ...options, inboxOnly: false });
}

async function listEmails(options: {
  maxResults?: number;
  query?: string;
  inboxOnly: boolean;
}): Promise<EmailSummary[]> {
  const gmail = await getGmailClient();
  const maxResults = normalizeMaxResults(options.maxResults);

  const response = await gmail.users.messages.list({
    userId: USER_ID,
    maxResults,
    q: options.query || undefined,
    labelIds: options.inboxOnly ? ["INBOX"] : undefined,
  });

  const messages = response.data.messages ?? [];

  return Promise.all(
    messages.map(async (message) => {
      const detail = await gmail.users.messages.get({
        userId: USER_ID,
        id: requiredId(message.id),
        format: "metadata",
        metadataHeaders: ["From", "To", "Subject", "Date"],
        fields:
          "id,threadId,snippet,labelIds,payload(headers(name,value))",
      });

      return toEmailSummary(detail.data);
    }),
  );
}

export async function getEmail(messageId: string): Promise<EmailDetail> {
  const gmail = await getGmailClient();
  const response = await gmail.users.messages.get({
    userId: USER_ID,
    id: messageId,
    format: "full",
  });

  return toEmailDetail(response.data);
}

export async function listLabels(): Promise<GmailLabel[]> {
  const gmail = await getGmailClient();
  const response = await gmail.users.labels.list({ userId: USER_ID });

  return (response.data.labels ?? []).map((label) => ({
    id: label.id,
    name: label.name,
    type: label.type,
    messageListVisibility: label.messageListVisibility,
    labelListVisibility: label.labelListVisibility,
  }));
}

function toEmailSummary(message: gmail_v1.Schema$Message): EmailSummary {
  const headers = headersToRecord(message.payload?.headers ?? []);

  return {
    id: requiredId(message.id),
    threadId: message.threadId,
    snippet: message.snippet,
    from: headers.from,
    to: headers.to,
    subject: headers.subject,
    date: headers.date,
    labels: message.labelIds,
  };
}

function toEmailDetail(message: gmail_v1.Schema$Message): EmailDetail {
  const summary = toEmailSummary(message);
  const headers = headersToRecord(message.payload?.headers ?? []);
  const body = extractBody(message.payload);

  return {
    ...summary,
    cc: headers.cc,
    bcc: headers.bcc,
    bodyText: body.text,
    bodyHtml: body.html,
    attachments: body.attachments,
    internalDate: message.internalDate,
  };
}

function headersToRecord(
  headers: gmail_v1.Schema$MessagePartHeader[],
): Record<string, string> {
  return headers.reduce<Record<string, string>>((acc, header) => {
    if (header.name && header.value) {
      acc[header.name.toLowerCase()] = header.value;
    }

    return acc;
  }, {});
}

function extractBody(part: gmail_v1.Schema$MessagePart | undefined): {
  text?: string;
  html?: string;
  attachments: EmailDetail["attachments"];
} {
  const result: {
    text?: string;
    html?: string;
    attachments: EmailDetail["attachments"];
  } = { attachments: [] };

  visitMessagePart(part, result);
  return result;
}

function visitMessagePart(
  part: gmail_v1.Schema$MessagePart | undefined,
  result: {
    text?: string;
    html?: string;
    attachments: EmailDetail["attachments"];
  },
): void {
  if (!part) {
    return;
  }

  const filename = part.filename ?? "";
  const attachmentId = part.body?.attachmentId ?? undefined;

  if (filename || attachmentId) {
    result.attachments.push({
      filename,
      mimeType: part.mimeType,
      attachmentId,
      size: part.body?.size,
    });
  }

  const data = part.body?.data;
  if (data && part.mimeType === "text/plain" && !result.text) {
    result.text = decodeBase64Url(data);
  }

  if (data && part.mimeType === "text/html" && !result.html) {
    result.html = decodeBase64Url(data);
  }

  for (const child of part.parts ?? []) {
    visitMessagePart(child, result);
  }
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
    "utf8",
  );
}

function normalizeMaxResults(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return 10;
  }

  return Math.min(Math.max(Math.trunc(value), 1), 50);
}

function requiredId(id: string | null | undefined): string {
  if (!id) {
    throw new Error("Gmail API returned a message without an id.");
  }

  return id;
}

