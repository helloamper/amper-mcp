/**
 * Tool discovery - fetches available tools from the Amper API.
 * Caches the result for 5 minutes to avoid hitting the API on every MCP request.
 */

const AMPER_BASE_URL =
  process.env.AMPER_BASE_URL || "https://app.amper.chat/api/v1";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface AmperToolParam {
  type: string;
  required?: boolean;
  description?: string;
  default?: unknown;
  enum?: string[];
}

export interface AmperTool {
  name: string;
  description: string;
  type: "read" | "trade";
  params: Record<string, AmperToolParam>;
}

let cachedTools: AmperTool[] | null = null;
let cacheTimestamp = 0;

/**
 * Fetches all available tools from GET /api/v1/tools.
 * Returns cached result if still fresh.
 */
export async function discoverTools(apiKey: string): Promise<AmperTool[]> {
  const now = Date.now();
  if (cachedTools && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedTools;
  }

  const response = await fetch(`${AMPER_BASE_URL}/tools`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Amper API /tools returned ${response.status}: ${body.slice(0, 200)}`
    );
  }

  const data = (await response.json()) as { tools: AmperTool[] };

  if (!data.tools || !Array.isArray(data.tools)) {
    throw new Error("Unexpected response from /tools: missing tools array");
  }

  cachedTools = data.tools;
  cacheTimestamp = now;

  return data.tools;
}

/**
 * Invalidate the tool cache (e.g., after a config change).
 */
export function invalidateCache(): void {
  cachedTools = null;
  cacheTimestamp = 0;
}
