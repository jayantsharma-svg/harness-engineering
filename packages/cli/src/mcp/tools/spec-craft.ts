/**
 * MCP tool: `mcp__harness__spec_craft`.
 *
 * Wraps spec-craft (craft-pipeline #6).
 *
 * Source: docs/changes/craft-pipeline/spec-craft/proposal.md
 *   (Surface area → MCP tool).
 */

import { runSpecCraft, type SpecCraftInput, type SpecCraftOutput } from '../../spec-craft/index.js';

interface ToolResponse {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export const specCraftDefinition = {
  name: 'spec_craft',
  description:
    'LLM-judgment critique of spec quality (proposals + ADRs). Second craft-pipeline ' +
    'ceiling skill; 7 seed rubrics from the spec-quality canon. Per-section critique with ' +
    'rubric-to-section mapping. Emits 3-axis findings (tier x impact x confidence per ADR 0019).',
  inputSchema: {
    type: 'object' as const,
    properties: {
      path: { type: 'string', description: 'Project root path' },
      files: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional spec file/glob scope',
      },
      kinds: {
        type: 'array',
        items: { type: 'string', enum: ['proposal', 'adr'] },
        description: 'Restrict to specific spec kinds (default: both)',
      },
      sections: {
        type: 'array',
        items: { type: 'string' },
        description: 'Restrict to canonical section names (e.g., decisions, scope)',
      },
      maxFiles: { type: 'number', description: 'Cap doc count (default: 50)' },
      maxSectionsPerFile: {
        type: 'number',
        description: 'Cap per-doc section critique (default: 10)',
      },
    },
    required: ['path'],
  },
};

export async function handleSpecCraft(input: SpecCraftInput): Promise<ToolResponse> {
  if (typeof input?.path !== 'string' || input.path.length === 0) {
    return {
      content: [
        { type: 'text', text: JSON.stringify({ error: 'spec_craft: `path` is required' }) },
      ],
      isError: true,
    };
  }
  try {
    const result: SpecCraftOutput = await runSpecCraft(input);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: `spec_craft failed: ${message}` }) }],
      isError: true,
    };
  }
}

export { runSpecCraft } from '../../spec-craft/index.js';
export type { SpecCraftInput, SpecCraftOutput } from '../../spec-craft/index.js';
