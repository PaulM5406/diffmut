import type { ChangedFile } from '../diff/types.js';
import type { MutationGenerationResult } from './types.js';

export interface MutationProvider {
  readonly name: string;
  generateMutations(file: ChangedFile, count: number): Promise<MutationGenerationResult>;
}
