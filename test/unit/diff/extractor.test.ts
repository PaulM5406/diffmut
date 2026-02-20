import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test the diff parser by importing it indirectly through a focused test
// on parseUnifiedDiff-like behavior via the extractDiff function.
// Since extractDiff calls git and fs, we mock those.

vi.mock('../../../src/utils/git.js', () => ({
  gitDiff: vi.fn(),
  gitRoot: vi.fn(() => '/fake/repo'),
}));

import fs from 'node:fs';
import { extractDiff } from '../../../src/diff/extractor.js';
import { gitDiff, gitRoot } from '../../../src/utils/git.js';

vi.mock('node:fs', async () => {
  const actual = await vi.importActual('node:fs');
  return {
    ...actual,
    default: {
      ...(actual as any).default,
      existsSync: vi.fn(() => true),
      readFileSync: vi.fn(() => 'line1\nline2\nline3\nline4\nline5\n'),
    },
  };
});

describe('extractDiff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty result for empty diff', () => {
    vi.mocked(gitDiff).mockReturnValue('');
    const result = extractDiff('origin/main');
    expect(result.files).toHaveLength(0);
    expect(result.baseRef).toBe('origin/main');
  });

  it('should parse a simple unified diff', () => {
    vi.mocked(gitDiff).mockReturnValue(
      `diff --git a/src/utils.ts b/src/utils.ts
index abc..def 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -1,3 +1,4 @@
 line1
+new line
 line2
 line3
`,
    );

    const result = extractDiff('origin/main');
    expect(result.files).toHaveLength(1);
    expect(result.files[0].filePath).toBe('src/utils.ts');
    expect(result.files[0].language).toBe('typescript');
    expect(result.files[0].hunks).toHaveLength(1);
    expect(result.files[0].hunks[0].lines).toHaveLength(1);
    expect(result.files[0].hunks[0].lines[0].lineNumber).toBe(2);
    expect(result.files[0].hunks[0].lines[0].content).toBe('new line');
    expect(result.files[0].hunks[0].lines[0].type).toBe('added');
  });

  it('should respect include filter', () => {
    vi.mocked(gitDiff).mockReturnValue(
      `diff --git a/src/utils.ts b/src/utils.ts
index abc..def 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -1,3 +1,4 @@
 line1
+new line
 line2
 line3
diff --git a/src/test.py b/src/test.py
index abc..def 100644
--- a/src/test.py
+++ b/src/test.py
@@ -1,2 +1,3 @@
 line1
+new line
 line2
`,
    );

    const result = extractDiff('origin/main', ['**/*.ts']);
    expect(result.files).toHaveLength(1);
    expect(result.files[0].filePath).toBe('src/utils.ts');
  });

  it('should respect exclude filter', () => {
    vi.mocked(gitDiff).mockReturnValue(
      `diff --git a/src/utils.ts b/src/utils.ts
index abc..def 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -1,3 +1,4 @@
 line1
+new line
 line2
 line3
`,
    );

    const result = extractDiff('origin/main', undefined, ['**/*.ts']);
    expect(result.files).toHaveLength(0);
  });

  it('should handle multiple hunks in one file', () => {
    vi.mocked(gitDiff).mockReturnValue(
      `diff --git a/src/utils.ts b/src/utils.ts
index abc..def 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -1,3 +1,4 @@
 line1
+added1
 line2
 line3
@@ -10,3 +11,4 @@
 line10
+added2
 line11
 line12
`,
    );

    const result = extractDiff('origin/main');
    expect(result.files).toHaveLength(1);
    expect(result.files[0].hunks).toHaveLength(2);
    expect(result.files[0].hunks[0].lines[0].lineNumber).toBe(2);
    expect(result.files[0].hunks[1].lines[0].lineNumber).toBe(12);
  });
});
