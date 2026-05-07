# Gmail MCP Server

Gmail MCP Server 是一个基于 Node.js/TypeScript 的 MCP stdio server，用于让 OpenClaw 通过 Model Context Protocol 读取 Gmail 邮件。

## 功能

- 使用 Gmail API OAuth 2.0 授权，权限范围为只读：`https://www.googleapis.com/auth/gmail.readonly`
- `list_emails`：列出收件箱邮件，支持 `maxResults` 和 Gmail `query` 过滤
- `get_email`：通过 `messageId` 读取单封邮件详情
- `search_emails`：通过 Gmail 搜索语法搜索邮件
- `list_labels`：列出所有 Gmail 标签/文件夹
- 支持 MCP stdio transport，可供 OpenClaw 调用

## 环境要求

- Node.js 18 或更高版本
- npm
- 一个可以访问 Gmail API 的 Google 账号

## 安装

```bash
npm install
npm run build
```

## 在 Google Cloud Console 创建 OAuth 凭证

1. 打开 [Google Cloud Console](https://console.cloud.google.com/)。
2. 创建或选择一个项目。
3. 进入 `APIs & Services` -> `Library`，搜索并启用 `Gmail API`。
4. 进入 `APIs & Services` -> `OAuth consent screen`。
5. 选择用户类型。个人使用通常选择 `External`。
6. 填写应用名称、用户支持邮箱、开发者联系邮箱。
7. 在 Scopes 步骤中添加 Gmail 只读权限：`https://www.googleapis.com/auth/gmail.readonly`。
8. 如果应用处于 Testing 状态，在 Test users 中添加你的 Gmail 账号。
9. 进入 `APIs & Services` -> `Credentials`。
10. 点击 `Create Credentials` -> `OAuth client ID`。
11. Application type 选择 `Desktop app`。
12. 创建后下载 JSON 文件。

## 放置 credentials.json

创建配置目录，并把下载的 OAuth JSON 保存为：

```bash
mkdir -p ~/.gmail-mcp
chmod 700 ~/.gmail-mcp
cp /path/to/downloaded/client_secret.json ~/.gmail-mcp/credentials.json
chmod 600 ~/.gmail-mcp/credentials.json
```

最终路径必须是：

```text
~/.gmail-mcp/credentials.json
```

## 运行授权流程

```bash
npm run auth
```

脚本会：

- 启动一个临时本地 OAuth 回调服务
- 打开浏览器进行 Google 授权
- 授权完成后保存 token 到 `~/.gmail-mcp/token.json`

如果浏览器没有自动打开，终端会打印授权 URL，手动复制到浏览器即可。

## 启动 MCP Server

```bash
npm run start
```

`start` 使用 stdio transport，通常由 OpenClaw 作为 MCP server 子进程启动，不需要手动长期运行。

## OpenClaw MCP 配置示例

把命令指向本项目构建后的入口：

```json
{
  "mcpServers": {
    "gmail": {
      "command": "node",
      "args": ["/Volumes/DevDisk/symbol/gmailMCP/dist/src/index.js"]
    }
  }
}
```

也可以在项目目录内用 npm 启动：

```json
{
  "mcpServers": {
    "gmail": {
      "command": "npm",
      "args": ["run", "start"],
      "cwd": "/Volumes/DevDisk/symbol/gmailMCP"
    }
  }
}
```

## Tools 参数说明

### list_emails

列出收件箱邮件。

```json
{
  "maxResults": 10,
  "query": "from:example@gmail.com newer_than:7d"
}
```

- `maxResults`：可选，默认 `10`，最大 `50`
- `query`：可选，Gmail 搜索语法，会限制在 INBOX 内查询

### get_email

读取单封邮件详情。

```json
{
  "messageId": "18f..."
}
```

返回字段包含发件人、收件人、主题、日期、标签、正文文本、HTML 正文和附件元数据。

### search_emails

搜索 Gmail 邮件。

```json
{
  "query": "subject:invoice has:attachment newer_than:30d",
  "maxResults": 10
}
```

- `query`：必填，支持 Gmail 搜索语法
- `maxResults`：可选，默认 `10`，最大 `50`

### list_labels

列出所有标签/文件夹。

```json
{}
```

## 文件位置

- OAuth credentials：`~/.gmail-mcp/credentials.json`
- OAuth token：`~/.gmail-mcp/token.json`
- MCP server 入口：`dist/src/index.js`

## 常见问题

### Missing Gmail OAuth credentials

确认已下载 Google OAuth client JSON，并保存到：

```text
~/.gmail-mcp/credentials.json
```

### Missing Gmail OAuth token

先运行：

```bash
npm run auth
```

### access_denied 或应用未验证

如果 OAuth consent screen 还在 Testing 状态，需要把当前 Gmail 账号添加到 Test users。

### invalid_grant

删除旧 token 后重新授权：

```bash
rm ~/.gmail-mcp/token.json
npm run auth
```
