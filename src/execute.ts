/**
 * Tool execution - calls POST /api/v1/execute on the Amper API.
 * Generates a unique idempotency key per request.
 */

import { randomUUID } from "node:crypto";

const AMPER_BASE_URL =
  process.env.AMPER_BASE_URL || "https://app.amper.chat/api/v1";

// Timeouts matching Amper's server limits
const TRADE_TIMEOUT_MS = 65_000; // 60s server + 5s buffer
const READ_TIMEOUT_MS = 35_000; // 30s server + 5s buffer

export interface ExecuteResult {
  success: boolean;
  tool?: string;
  result?: string;
  steps?: Array<{ status: string; label: string }>;
  data?: unknown;
  metadata?: {
    txHash?: string;
    blockNumber?: number;
    gasUsed?: string;
    executionMs?: number;
  };
  request_id?: string;
  // Error fields
  error?: string;
  message?: string;
  retry_after?: number;
}

// Simple in-memory set of known trade tools. Updated by the caller.
const tradeTools = new Set<string>();

export function markTradeTools(toolNames: string[]): void {
  for (const name of toolNames) {
    tradeTools.add(name);
  }
}

/**
 * Execute a single tool via the Amper API.
 */
export async function executeTool(
  apiKey: string,
  tool: string,
  params: Record<string, unknown>
): Promise<ExecuteResult> {
  const idempotencyKey = randomUUID();
  const isTrade = tradeTools.has(tool);
  const timeoutMs = isTrade ? TRADE_TIMEOUT_MS : READ_TIMEOUT_MS;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${AMPER_BASE_URL}/execute`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-Idempotency-Key": idempotencyKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tool, params }),
      signal: controller.signal,
    });

    const data = (await response.json()) as ExecuteResult;

    // Handle rate limiting with retry info
    if (response.status === 429 && data.retry_after) {
      return {
        success: false,
        error: data.error || "rate_limit",
        message: `${data.message || "Rate limited"}. Retry after ${data.retry_after} seconds.`,
        retry_after: data.retry_after,
      };
    }

    return data;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      return {
        success: false,
        error: "timeout",
        message: `Request timed out after ${timeoutMs / 1000}s`,
      };
    }

    return {
      success: false,
      error: "network_error",
      message:
        err instanceof Error ? err.message : "Unknown network error",
    };
  } finally {
    clearTimeout(timer);
  }
}
