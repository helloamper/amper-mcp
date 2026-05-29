#!/usr/bin/env node

/**
 * Amper MCP Server
 *
 * Exposes Amper's 80+ DeFi tools to any MCP client (Hermes, Claude Code, Cursor).
 * Dynamically discovers tools from GET /api/v1/tools and registers each as an MCP tool.
 * Executes via POST /api/v1/execute.
 *
 * Usage:
 *   AMPER_API_KEY=amp_live_xxx npx amper-mcp-server
 *
 * Hermes config:
 *   mcp_servers:
 *     amper:
 *       command: "node"
 *       args: ["path/to/amper-mcp-server/dist/index.js"]
 *       env:
 *         AMPER_API_KEY: "${AMPER_API_KEY}"
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { discoverTools, type AmperTool } from "./tools.js";
import { executeTool, markTradeTools } from "./execute.js";

const AMPER_API_KEY = process.env.AMPER_API_KEY ?? "";

if (!AMPER_API_KEY) {
  console.error(
    "AMPER_API_KEY is required. Set it as an environment variable.\n" +
      "Get one at https://app.amper.chat > Settings > API"
  );
  process.exit(1);
}

async function main() {
  // Discover all tools from the Amper API
  let tools: AmperTool[];
  try {
    tools = await discoverTools(AMPER_API_KEY);
  } catch (err) {
    console.error("Failed to discover Amper tools:", err);
    process.exit(1);
  }

  // Mark trade tools for timeout handling
  markTradeTools(
    tools.filter((t) => t.type === "trade").map((t) => t.name)
  );

  // Build a lookup map
  const toolMap = new Map<string, AmperTool>();
  for (const tool of tools) {
    toolMap.set(tool.name, tool);
  }

  const server = new Server(
    { name: "amper-defi", version: "0.1.0" },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handle tools/list - return all Amper tools with JSON schemas
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: buildJsonSchema(tool),
      })),
    };
  });

  // Handle tools/call - execute a tool via Amper API
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const params = (args as Record<string, unknown>) ?? {};

    const tool = toolMap.get(name);
    if (!tool) {
      return {
        content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    const result = await executeTool(AMPER_API_KEY, name, params);

    if (!result.success) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error [${result.error}]: ${result.message}`,
          },
        ],
        isError: true,
      };
    }

    // Build a rich text response
    const parts: string[] = [];

    if (result.result) {
      parts.push(result.result);
    }

    if (result.steps?.length) {
      parts.push(
        "\nSteps:\n" +
          result.steps
            .map((s) => `  [${s.status}] ${s.label}`)
            .join("\n")
      );
    }

    if (result.metadata?.txHash) {
      parts.push(`\nTx: ${result.metadata.txHash}`);
    }

    if (result.metadata?.executionMs) {
      parts.push(`Execution: ${result.metadata.executionMs}ms`);
    }

    return {
      content: [{ type: "text" as const, text: parts.join("\n") }],
    };
  });

  console.error(
    `Amper MCP Server ready. ${tools.length} tools registered ` +
      `(${tools.filter((t) => t.type === "trade").length} trade, ` +
      `${tools.filter((t) => t.type === "read").length} read).`
  );

  // Connect via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

/**
 * Build a JSON Schema object from an Amper tool definition.
 * The low-level MCP Server accepts raw JSON Schema for inputSchema.
 */
function buildJsonSchema(tool: AmperTool): Record<string, unknown> {
  if (!tool.params || Object.keys(tool.params).length === 0) {
    return { type: "object", properties: {} };
  }

  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, param] of Object.entries(tool.params)) {
    const prop: Record<string, unknown> = {
      type: param.type || "string",
    };
    if (param.description) prop.description = param.description;
    if (param.default !== undefined) prop.default = param.default;
    if (param.enum) prop.enum = param.enum;

    properties[key] = prop;

    if (param.required) {
      required.push(key);
    }
  }

  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
