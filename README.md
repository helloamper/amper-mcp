# Amper MCP Server

MCP server that exposes [Amper's](https://amper.chat) 80+ DeFi tools to any MCP-compatible client.

Natural language in, onchain transactions out.

## Quick Install

Add Amper to your MCP client with a single config block. Requires **Node.js 18+** and an [Amper API key](#get-an-api-key).

### Claude Code

Add to `.mcp.json` (project root) or `~/.claude.json` (global):

```json
{
  "mcpServers": {
    "amper": {
      "command": "npx",
      "args": ["-y", "amper-mcp-server"],
      "env": {
        "AMPER_API_KEY": "amp_live_your_key_here"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "amper": {
      "command": "npx",
      "args": ["-y", "amper-mcp-server"],
      "env": {
        "AMPER_API_KEY": "amp_live_your_key_here"
      }
    }
  }
}
```

### Windsurf

Add to `.windsurf/mcp.json`:

```json
{
  "mcpServers": {
    "amper": {
      "command": "npx",
      "args": ["-y", "amper-mcp-server"],
      "env": {
        "AMPER_API_KEY": "amp_live_your_key_here"
      }
    }
  }
}
```

### Hermes

```yaml
# ~/.hermes/config.yaml
mcp_servers:
  amper:
    command: "npx"
    args: ["-y", "amper-mcp-server"]
    env:
      AMPER_API_KEY: "amp_live_your_key_here"
```

Or install globally for faster startup:

```bash
npm install -g amper-mcp-server
```

```yaml
# ~/.hermes/config.yaml
mcp_servers:
  amper:
    command: "amper-mcp-server"
    env:
      AMPER_API_KEY: "amp_live_your_key_here"
```

---

## Get an API Key

1. Sign up at [app.amper.chat](https://app.amper.chat)
2. Subscribe ($6/month, 500 requests/day) or fund your embedded wallet with USDC on Base for pay-per-request (https://www.amper.chat/docs/api/pricing)
3. Go to **Settings > API** and create a key
4. Keys start with `amp_live_` and come in two scopes:
   - **Read**. Price checks, analytics, portfolio queries
   - **Write**. Everything above plus swaps, lending, bridging, and all onchain execution

---

## Hermes Full Setup Guide

[Hermes](https://github.com/NousResearch/hermes-agent) is an open-source terminal agent by Nous Research. Follow these steps to go from zero to executing DeFi operations from your terminal.

### 1. Install Hermes

**macOS / Linux / WSL2:**

```bash
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
```

**Windows (PowerShell):**

```powershell
iex (irm https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.ps1)
```

Verify the installation:

```bash
hermes --version
```

Then run initial setup:

```bash
hermes setup
```

This will prompt you for your preferred LLM provider and model. If you have a Nous Portal account, use `hermes setup --portal` instead.

### 2. Add the Amper MCP Server

Edit `~/.hermes/config.yaml` and add the `amper` entry under `mcp_servers` (see [Hermes config](#hermes) above).

### 3. Verify

Launch Hermes and try a few commands:

```bash
hermes
```

```
> What is the price of ETH?
> Show my portfolio on Base
> Swap 0.001 ETH to USDC on Base
```

Type `/tools` inside Hermes to list all available Amper tools.

---

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `AMPER_API_KEY` | Yes | Your API key (must start with `amp_live_`) |
| `AMPER_BASE_URL` | No | Override the API base URL (default: `https://app.amper.chat/api/v1`) |

## Rate Limits

| Limit | Value |
|-------|-------|
| Per minute | 30 requests |
| Per day | 500 requests |
| Concurrency | Sequential (one at a time per key) |

## How It Works

- **Discovery**. Fetches all tools from `/api/v1/tools` on startup (cached 5 min).
- **Execution**. Each tool call hits `POST /api/v1/execute` with a unique idempotency key.
- **Timeouts**. 65s for trade tools, 35s for read tools.
- **Transport**. Stdio. Your MCP client spawns the server as a subprocess.

## Available Tools

80+ tools across these categories:

| Category | Examples |
|----------|----------|
| **Token Operations** | Swaps, transfers, approvals, wrapping |
| **Lending** | Aave v3 deposits, withdrawals, borrowing |
| **Vaults** | Morpho vault deposits, withdrawals, rewards |
| **Perpetuals** | Avantis positions and limit orders (up to 500x) |
| **Options** | Derive options trading and sessions |
| **Staking** | Venice staking and reward claims |
| **Token Creation** | Clanker token deployment and image generation |
| **Analytics** | DefiLlama TVL, Codex token data, price feeds |
| **Bridges** | Cross-chain transfers |

## Troubleshooting

| Error | Fix |
|-------|-----|
| `invalid_key` | Check that your key starts with `amp_live_` |
| `key_expired` | Generate a new key in Settings > API |
| `scope_denied` | You're using a Read key for a write operation. Create a Write key |
| `payment_required` | No active subscription or insufficient USDC balance |
| MCP server not loading | Verify Node.js 18+ is installed (`node --version`) |
| Tools not appearing (Hermes) | Run `/reload-mcp` inside Hermes |

## License

MIT
