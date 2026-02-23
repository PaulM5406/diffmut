import type { ChangedFile } from '../diff/types.js';
import type { PromptOptions } from './prompt.js';
import type { MutationGenerationResult } from './types.js';

export interface MutationProvider {
  readonly name: string;
  generateMutations(files: ChangedFile[], count: number, options?: PromptOptions): Promise<MutationGenerationResult>;
}
