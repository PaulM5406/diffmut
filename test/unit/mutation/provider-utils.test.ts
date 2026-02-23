import { describe, it, expect, beforeEach } from 'vitest';
import type { ChangedFile } from '../../../src/diff/types.js';
import type { MutationResponse } from '../../../src/mutation/schemas.js';
import {
  generateMutationId,
  isWithinDiffBounds,
  filterAndMapMultiFileMutations,
  shouldRetryOnStatus,
  resetMutationCounter,
} from '../../../src/mutation/provider-utils.js';
import { makeFile } from '../../helpers.js';

beforeEach(() => {
  resetMutationCounter();
});

// ---------------------------------------------------------------------------
// generateMutationId
// ---------------------------------------------------------------------------

describe('generateMutationId', () => {
  it('replaces non-alphanumeric characters and appends an incrementing counter', () => {
    expect(generateMutationId('src/test.ts')).toBe('mut-src-test-ts-1');
  });

  it('increments counter on successive calls', () => {
    expect(generateMutationId('src/test.ts')).toBe('mut-src-test-ts-1');
    expect(generateMutationId('src/test.ts')).toBe('mut-src-test-ts-2');
  });

  it('uses the file path in the id', () => {
    expect(generateMutationId('lib/utils/helper.ts')).toBe('mut-lib-utils-helper-ts-1');
  });
});

// ---------------------------------------------------------------------------
// isWithinDiffBounds
// ---------------------------------------------------------------------------

describe('isWithinDiffBounds', () => {
  it('returns true when mutation overlaps a changed line', () => {
    const file = makeFile(); // changed lines: 2, 3
    expect(isWithinDiffBounds({ startLine: 2, endLine: 2 }, file)).toBe(true);
    expect(isWithinDiffBounds({ startLine: 3, endLine: 3 }, file)).toBe(true);
  });

  it('returns true when mutation range spans a changed line', () => {
    const file = makeFile(); // changed lines: 2, 3
    expect(isWithinDiffBounds({ startLine: 1, endLine: 3 }, file)).toBe(true);
  });

  it('returns false when mutation is entirely before the changed lines', () => {
    const file = makeFile(); // changed lines: 2, 3
    expect(isWithinDiffBounds({ startLine: 1, endLine: 1 }, file)).toBe(false);
  });

  it('returns false when mutation is entirely after the changed lines', () => {
    const file = makeFile(); // changed lines: 2, 3
    expect(isWithinDiffBounds({ startLine: 4, endLine: 5 }, file)).toBe(false);
  });

  it('returns false when the file has no changed lines', () => {
    const file = makeFile({ hunks: [] });
    expect(isWithinDiffBounds({ startLine: 1, endLine: 5 }, file)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// filterAndMapMultiFileMutations
// ---------------------------------------------------------------------------

const baseMutation = {
  startLine: 2,
  endLine: 2,
  originalCode: 'line2',
  mutatedCode: 'line2_mutated',
  description: 'test mutation',
  category: 'conditional-logic' as const,
};

function makeParsed(overrides: Partial<typeof baseMutation & { filePath: string }>[] = []): MutationResponse {
  return {
    mutations: overrides.map((o) => ({ ...baseMutation, filePath: 'src/test.ts', ...o })),
  };
}

describe('filterAndMapMultiFileMutations', () => {
  it('keeps mutations within diff bounds and assigns an id and filePath', () => {
    const file = makeFile();
    const parsed = makeParsed([{}]);

    const result = filterAndMapMultiFileMutations(parsed, [file]);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('mut-src-test-ts-1');
    expect(result[0].filePath).toBe('src/test.ts');
  });

  it('filters mutations outside diff bounds', () => {
    const file = makeFile(); // changed lines: 2, 3
    const parsed = makeParsed([{ startLine: 5, endLine: 5 }]);

    const result = filterAndMapMultiFileMutations(parsed, [file]);

    expect(result).toHaveLength(0);
  });

  it('filters equivalent mutations where originalCode equals mutatedCode', () => {
    const file = makeFile();
    const parsed = makeParsed([{ mutatedCode: 'line2' }]); // same as originalCode

    const result = filterAndMapMultiFileMutations(parsed, [file]);

    expect(result).toHaveLength(0);
  });

  it('filters mutations with an unknown filePath', () => {
    const file = makeFile();
    const parsed = makeParsed([{ filePath: 'src/unknown.ts' }]);

    const result = filterAndMapMultiFileMutations(parsed, [file]);

    expect(result).toHaveLength(0);
  });

  it('normalizes a leading ./ in the mutation filePath', () => {
    const file = makeFile(); // filePath: 'src/test.ts'
    const parsed = makeParsed([{ filePath: './src/test.ts' }]);

    const result = filterAndMapMultiFileMutations(parsed, [file]);

    expect(result).toHaveLength(1);
    expect(result[0].filePath).toBe('src/test.ts');
  });

  it('normalizes a leading ./ in the file filePath', () => {
    const file = makeFile({ filePath: './src/test.ts' });
    const parsed = makeParsed([{ filePath: 'src/test.ts' }]);

    const result = filterAndMapMultiFileMutations(parsed, [file]);

    expect(result).toHaveLength(1);
  });

  it('assigns sequential ids across multiple mutations', () => {
    const file = makeFile();
    const parsed = makeParsed([
      {},
      { startLine: 3, endLine: 3, originalCode: 'line3', mutatedCode: 'line3_mutated' },
    ]);

    const result = filterAndMapMultiFileMutations(parsed, [file]);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('mut-src-test-ts-1');
    expect(result[1].id).toBe('mut-src-test-ts-2');
  });

  it('handles multiple files and maps mutations to the correct file', () => {
    const fileA = makeFile({ filePath: 'src/a.ts' });
    const fileB = makeFile({ filePath: 'src/b.ts' });
    const parsed: MutationResponse = {
      mutations: [
        { ...baseMutation, filePath: 'src/a.ts' },
        { ...baseMutation, filePath: 'src/b.ts' },
      ],
    };

    const result = filterAndMapMultiFileMutations(parsed, [fileA, fileB]);

    expect(result).toHaveLength(2);
    expect(result[0].filePath).toBe('src/a.ts');
    expect(result[1].filePath).toBe('src/b.ts');
  });
});

// ---------------------------------------------------------------------------
// shouldRetryOnStatus
// ---------------------------------------------------------------------------

describe('shouldRetryOnStatus', () => {
  it('returns true for status 429', () => {
    expect(shouldRetryOnStatus({ status: 429 })).toBe(true);
  });

  it('returns true for status 500', () => {
    expect(shouldRetryOnStatus({ status: 500 })).toBe(true);
  });

  it('returns true for status 502', () => {
    expect(shouldRetryOnStatus({ status: 502 })).toBe(true);
  });

  it('returns true for status 503', () => {
    expect(shouldRetryOnStatus({ status: 503 })).toBe(true);
  });

  it('returns true for status 529', () => {
    expect(shouldRetryOnStatus({ status: 529 })).toBe(true);
  });

  it('returns true for an ECONNRESET error', () => {
    expect(shouldRetryOnStatus(new Error('read ECONNRESET'))).toBe(true);
  });

  it('returns true for an ETIMEDOUT error', () => {
    expect(shouldRetryOnStatus(new Error('connect ETIMEDOUT 1.2.3.4:443'))).toBe(true);
  });

  it('returns false for status 404', () => {
    expect(shouldRetryOnStatus({ status: 404 })).toBe(false);
  });

  it('returns false for status 400', () => {
    expect(shouldRetryOnStatus({ status: 400 })).toBe(false);
  });

  it('returns false for a generic error', () => {
    expect(shouldRetryOnStatus(new Error('something went wrong'))).toBe(false);
  });

  it('returns false for null', () => {
    expect(shouldRetryOnStatus(null)).toBe(false);
  });

  it('returns false for a plain string', () => {
    expect(shouldRetryOnStatus('error')).toBe(false);
  });
});
