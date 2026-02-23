import { describe, it, expect } from 'vitest';
import { buildAnnotatedContent, buildMultiFilePrompt } from '../../../src/mutation/prompt.js';
import { makeFile } from '../../helpers.js';

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

  it('truncates large files by showing only hunks with context and omission separators', () => {
    const content = Array.from({ length: 600 }, (_, i) => `line${i + 1}`).join('\n');
    const file = makeFile({
      currentContent: content,
      hunks: [
        {
          startLine: 300,
          lineCount: 1,
          lines: [{ lineNumber: 300, content: 'line300', type: 'added' }],
        },
      ],
    });
    const result = buildAnnotatedContent(file);

    expect(result).toContain('[CHANGED]');
    expect(result).toContain('lines omitted');
    // A full render of 600 lines would include line 400+ as [CONTEXT]; the truncated
    // output should not contain every line number up to 600.
    expect(result).not.toContain('  600 [CONTEXT]');
  });
});

describe('buildMultiFilePrompt', () => {
  it('should return system and user messages', () => {
    const files = [makeFile()];
    const messages = buildMultiFilePrompt(files, 5);

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
  });

  it('should include file headers with path and language', () => {
    const files = [
      makeFile({ filePath: 'src/foo.ts', language: 'typescript' }),
      makeFile({ filePath: 'src/bar.py', language: 'python' }),
    ];
    const messages = buildMultiFilePrompt(files, 5);

    expect(messages[1].content).toContain('=== File: src/foo.ts (typescript) ===');
    expect(messages[1].content).toContain('=== File: src/bar.py (python) ===');
  });

  it('should include total mutation count in user message', () => {
    const files = [makeFile()];
    const messages = buildMultiFilePrompt(files, 10);

    expect(messages[1].content).toContain('10 mutations');
  });

  it('should include annotated content for each file', () => {
    const files = [
      makeFile({ filePath: 'src/foo.ts' }),
      makeFile({ filePath: 'src/bar.ts' }),
    ];
    const messages = buildMultiFilePrompt(files, 5);

    // Should contain annotated content (line numbers and markers)
    expect(messages[1].content).toContain('[CHANGED]');
    expect(messages[1].content).toContain('[CONTEXT]');
  });

  it('should instruct LLM to include filePath in each mutation', () => {
    const files = [makeFile()];
    const messages = buildMultiFilePrompt(files, 5);

    expect(messages[1].content).toContain('filePath');
  });

  it('should work with a single file', () => {
    const files = [makeFile({ filePath: 'src/only.ts' })];
    const messages = buildMultiFilePrompt(files, 3);

    expect(messages[1].content).toContain('=== File: src/only.ts (typescript) ===');
    expect(messages[1].content).toContain('3 mutations');
  });
});
