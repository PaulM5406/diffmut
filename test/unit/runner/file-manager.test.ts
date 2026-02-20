import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { FileManager } from '../../../src/runner/file-manager.js';

describe('FileManager', () => {
  let tmpDir: string;
  let testFile: string;
  let fm: FileManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diffmut-test-'));
    testFile = path.join(tmpDir, 'test.txt');
    fs.writeFileSync(testFile, 'original content', 'utf-8');
    fm = new FileManager();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should backup and restore a file', () => {
    fm.backup(testFile);
    fm.applyMutation(testFile, 'mutated content');
    expect(fs.readFileSync(testFile, 'utf-8')).toBe('mutated content');

    fm.restore(testFile);
    expect(fs.readFileSync(testFile, 'utf-8')).toBe('original content');
  });

  it('should throw on applyMutation without backup', () => {
    expect(() => fm.applyMutation(testFile, 'x')).toThrow('No backup');
  });

  it('should throw on restore without backup', () => {
    expect(() => fm.restore(testFile)).toThrow('No backup');
  });

  it('should restoreAll multiple files', () => {
    const testFile2 = path.join(tmpDir, 'test2.txt');
    fs.writeFileSync(testFile2, 'original2', 'utf-8');

    fm.backup(testFile);
    fm.backup(testFile2);
    fm.applyMutation(testFile, 'mutated1');
    fm.applyMutation(testFile2, 'mutated2');

    expect(fs.readFileSync(testFile, 'utf-8')).toBe('mutated1');
    expect(fs.readFileSync(testFile2, 'utf-8')).toBe('mutated2');

    fm.restoreAll();
    expect(fs.readFileSync(testFile, 'utf-8')).toBe('original content');
    expect(fs.readFileSync(testFile2, 'utf-8')).toBe('original2');
  });
});
