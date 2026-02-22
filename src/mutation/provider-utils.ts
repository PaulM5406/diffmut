import type { ChangedFile } from '../diff/types.js';
import { logger } from '../utils/logger.js';
import type { Mutation } from './types.js';
import type { MutationResponse } from './schemas.js';

let mutationCounter = 0;

export function generateMutationId(filePath: string): string {
  return `mut-${filePath.replace(/[^a-zA-Z0-9]/g, '-')}-${++mutationCounter}`;
}

export function isWithinDiffBounds(
  mutation: { startLine: number; endLine: number },
  file: ChangedFile,
): boolean {
  const changedLines = new Set<number>();
  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      changedLines.add(line.lineNumber);
    }
  }
  for (let i = mutation.startLine; i <= mutation.endLine; i++) {
    if (changedLines.has(i)) return true;
  }
  return false;
}

export function filterAndMapMutations(
  parsed: MutationResponse,
  file: ChangedFile,
): Mutation[] {
  const validMutations: Mutation[] = [];
  for (const m of parsed.mutations) {
    if (!isWithinDiffBounds(m, file)) {
      logger.debug(`Filtered mutation outside diff bounds: lines ${m.startLine}-${m.endLine}`);
      continue;
    }
    if (m.originalCode === m.mutatedCode) {
      logger.debug(`Filtered equivalent mutation at line ${m.startLine}`);
      continue;
    }
    validMutations.push({
      ...m,
      id: generateMutationId(file.filePath),
      filePath: file.filePath,
    });
  }
  return validMutations;
}

function normalizePath(p: string): string {
  return p.replace(/^\.\//, '').trim();
}

export function filterAndMapMultiFileMutations(
  parsed: MutationResponse,
  files: ChangedFile[],
): Mutation[] {
  const fileMap = new Map<string, ChangedFile>();
  for (const file of files) {
    fileMap.set(normalizePath(file.filePath), file);
  }

  const validMutations: Mutation[] = [];
  for (const m of parsed.mutations) {
    const normalizedPath = normalizePath(m.filePath);
    const file = fileMap.get(normalizedPath);
    if (!file) {
      logger.debug(`Filtered mutation with unknown filePath: ${m.filePath}`);
      continue;
    }
    if (!isWithinDiffBounds(m, file)) {
      logger.debug(`Filtered mutation outside diff bounds: ${m.filePath} lines ${m.startLine}-${m.endLine}`);
      continue;
    }
    if (m.originalCode === m.mutatedCode) {
      logger.debug(`Filtered equivalent mutation at ${m.filePath}:${m.startLine}`);
      continue;
    }
    validMutations.push({
      ...m,
      id: generateMutationId(file.filePath),
      filePath: file.filePath,
    });
  }
  return validMutations;
}

export function shouldRetryOnStatus(err: unknown): boolean {
  if (err && typeof err === 'object' && 'status' in err) {
    const status = (err as { status: number }).status;
    return status === 429 || status === 500 || status === 502 || status === 503 || status === 529;
  }
  if (err instanceof Error && (err.message.includes('ECONNRESET') || err.message.includes('ETIMEDOUT'))) {
    return true;
  }
  return false;
}

/** Reset the mutation counter (for testing) */
export function resetMutationCounter(): void {
  mutationCounter = 0;
}
