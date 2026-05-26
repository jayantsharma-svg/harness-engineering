export interface KnowledgeRubric {
  id: string;
  title: string;
  description: string;
  source: string;
  contribution: { addedAt: string; addedBy: string };
  signal: { invocations: number; suppressedAt: string[] };
  version: number;
}
