#!/usr/bin/env node

// Handle `npx gmail-mcp-server auth` subcommand
if (process.argv.includes("auth")) {
  await import("../scripts/auth.js");
} else {
  const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
  const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
  const { z } = await import("zod");
  const { getEmail, listInboxEmails, listLabels, searchEmails } = await import("./gmail.js");

  const server = new McpServer({
    name: "gmail-mcp-server",
    version: "0.1.0",
  });

  server.tool(
    "list_emails",
    "List Gmail inbox messages. Supports maxResults and Gmail query filters.",
    {
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe("Maximum number of emails to return. Default 10, max 50."),
      query: z
        .string()
        .optional()
        .describe("Optional Gmail search query, applied within INBOX."),
    },
    async ({ maxResults, query }) => jsonResult(await listInboxEmails({ maxResults, query })),
  );

  server.tool(
    "get_email",
    "Read one Gmail message by messageId.",
    {
      messageId: z.string().min(1).describe("Gmail message id."),
    },
    async ({ messageId }) => jsonResult(await getEmail(messageId)),
  );

  server.tool(
    "search_emails",
    "Search Gmail messages with Gmail search syntax.",
    {
      query: z.string().min(1).describe("Gmail search query string."),
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe("Maximum number of emails to return. Default 10, max 50."),
    },
    async ({ query, maxResults }) => jsonResult(await searchEmails({ query, maxResults })),
  );

  server.tool("list_labels", "List all Gmail labels and folders.", {}, async () =>
    jsonResult(await listLabels()),
  );

  function jsonResult(value: unknown) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(value, null, 2),
        },
      ],
    };
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
