// packages/mcp-server/src/utils/result-adapter.ts
import type { Result } from '@harness-engineering/core';

export interface McpToolResponse {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export function bigIntSafeReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}

export function resultToMcpResponse(result: Result<unknown, { message: string }>): McpToolResponse {
  if (result.ok) {
    return {
      content: [
        {
          type: 'text',
          text:
            typeof result.value === 'string'
              ? result.value
              : JSON.stringify(result.value, bigIntSafeReplacer),
        },
      ],
    };
  }
  return {
    content: [{ type: 'text', text: result.error.message }],
    isError: true,
  };
}
