/**
 * MCP tool: `mcp__harness__knowledge_craft`.
 *
 * Wraps knowledge-craft (craft-pipeline #9).
 *
 * Source: docs/changes/craft-pipeline/knowledge-craft/proposal.md
 *   (Surface area → MCP tool).
 */

import {
  runKnowledgeCraft,
  type KnowledgeCraftInput,
  type KnowledgeCraftOutput,
} from '../../knowledge-craft/index.js';

interface ToolResponse {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export const knowledgeCraftDefinition = {
  name: 'knowledge_craft',
  description:
    'LLM-judgment critique of knowledge-entry quality (docs/knowledge/, excluding ' +
    'decisions/ — that is spec-craft territory). Fifth non-design craft-pipeline ceiling ' +
    'skill; 7 seed rubrics (load-bearing-fact, earns-graph-place, carries-forward-decision, …). ' +
    'Per-file critique. References graph taxonomy (business_fact / business_rule / ' +
    'business_concept / business_decision) inside rubrics without reading the graph. ' +
    'Emits 3-axis findings (tier x impact x confidence per ADR 0019).',
  inputSchema: {
    type: 'object' as const,
    properties: {
      path: { type: 'string', description: 'Project root path' },
      files: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional file scope (overrides docs/knowledge/ discovery)',
      },
      excludeDirs: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Extra subdir names to skip under docs/knowledge/ (decisions is always excluded)',
      },
      maxFiles: { type: 'number', description: 'Cap entry count (default: 50)' },
    },
    required: ['path'],
  },
};

export async function handleKnowledgeCraft(input: KnowledgeCraftInput): Promise<ToolResponse> {
  if (typeof input?.path !== 'string' || input.path.length === 0) {
    return {
      content: [
        { type: 'text', text: JSON.stringify({ error: 'knowledge_craft: `path` is required' }) },
      ],
      isError: true,
    };
  }
  try {
    const result: KnowledgeCraftOutput = await runKnowledgeCraft(input);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [
        { type: 'text', text: JSON.stringify({ error: `knowledge_craft failed: ${message}` }) },
      ],
      isError: true,
    };
  }
}

export { runKnowledgeCraft } from '../../knowledge-craft/index.js';
export type { KnowledgeCraftInput, KnowledgeCraftOutput } from '../../knowledge-craft/index.js';
