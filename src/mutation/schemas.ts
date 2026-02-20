import { z } from 'zod';

export const MutationItemSchema = z.object({
  startLine: z.number().int().describe('Starting line number (1-based) of the code to replace'),
  endLine: z.number().int().describe('Ending line number (1-based, inclusive) of the code to replace'),
  originalCode: z.string().describe('The exact original code being replaced (for verification)'),
  mutatedCode: z.string().describe('The mutated code to substitute'),
  description: z.string().describe('Brief description of what the mutation does and why it tests a meaningful behavior'),
  category: z.enum([
    'boundary-condition',
    'logical-operator',
    'null-safety',
    'error-handling',
    'return-value',
    'conditional-logic',
    'off-by-one',
    'string-manipulation',
    'type-coercion',
    'api-contract',
  ]).describe('Category of the mutation'),
});

export const MutationResponseSchema = z.object({
  mutations: z.array(MutationItemSchema),
});

export type MutationResponse = z.infer<typeof MutationResponseSchema>;
