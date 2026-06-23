import { z } from 'zod';

// --- Enums ---

export const ModeSchema = z.enum(['adopter', 'toolkit']);
export type Mode = z.infer<typeof ModeSchema>;

export const SeveritySchema = z.enum(['error', 'warning', 'info']);
export type Severity = z.infer<typeof SeveritySchema>;

export const TierSchema = z.enum(['solid', 'at-risk', 'theatre']);
export type Tier = z.infer<typeof TierSchema>;

// --- Finding ---

export const StrengthFindingSchema = z.object({
  id: z.string(), // e.g. "STRENGTH-001"
  gearPiece: z.string(), // label only (v1) — gear piece this defends
  severity: SeveritySchema,
  file: z.string(), // relative to root
  line: z.number().int().positive().optional(), // when locatable
  message: z.string(), // what's wrong
  remediation: z.string(), // concrete fix
});
export type StrengthFinding = z.infer<typeof StrengthFindingSchema>;
