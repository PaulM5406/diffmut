import { describe, it, expect } from 'vitest';
import { buildAnnotatedContent, buildPrompt } from '../../../src/mutation/prompt.js';
import type { ChangedFile } from '../../../src/diff/types.js';

function makeFile(overrides: Partial<ChangedFile> = {}): ChangedFile {
  return {
    filePath: 'src/test.ts',
    currentContent: 'line1\nline2\nline3\nline4\nline5',
    hunks: [
      {
        startLine: 2,
        lineCount: 2,
        lines: [
          { lineNumber: 2, content: 'line2', type: 'added' },
          { lineNumber: 3, content: 'line3', type: 'added' },
        ],
      },
    ],
    language: 'typescript',
    ...overrides,
  };
}

describe('buildAnnotatedContent', () => {
  it('should mark changed lines with [CHANGED] and others with [CONTEXT]', () => {
    const file = makeFile();
    const result = buildAnnotatedContent(file);
    const lines = result.split('\n');

    expect(lines[0]).toContain('[CONTEXT]');
    expect(lines[0]).toContain('line1');
    expect(lines[1]).toContain('[CHANGED]');
    expect(lines[1]).toContain('line2');
    expect(lines[2]).toContain('[CHANGED]');
    expect(lines[2]).toContain('line3');
    expect(lines[3]).toContain('[CONTEXT]');
    expect(lines[3]).toContain('line4');
  });

  it('should include line numbers', () => {
    const file = makeFile();
    const result = buildAnnotatedContent(file);
    expect(result).toContain('   1');
    expect(result).toContain('   2');
    expect(result).toContain('   5');
  });
});

describe('buildPrompt', () => {
  it('should return system and user messages', () => {
    const file = makeFile();
    const messages = buildPrompt(file, 3);

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
  });

  it('should include file path and language in user message', () => {
    const file = makeFile();
    const messages = buildPrompt(file, 3);

    expect(messages[1].content).toContain('src/test.ts');
    expect(messages[1].content).toContain('typescript');
  });

  it('should include mutation count in user message', () => {
    const file = makeFile();
    const messages = buildPrompt(file, 7);

    expect(messages[1].content).toContain('7 mutations');
  });

  it('should include mutation categories in system prompt', () => {
    const file = makeFile();
    const messages = buildPrompt(file, 3);

    expect(messages[0].content).toContain('boundary-condition');
    expect(messages[0].content).toContain('logical-operator');
    expect(messages[0].content).toContain('null-safety');
  });
});
