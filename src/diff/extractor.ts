import fs from 'node:fs';
import path from 'node:path';
import { minimatch } from 'minimatch';
import { gitDiff, gitRoot } from '../utils/git.js';
import type { ChangedFile, ChangedHunk, ChangedLine, DiffResult } from './types.js';
import { isTestFile } from './test-patterns.js';

const LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.py': 'python',
  '.rb': 'ruby',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.kt': 'kotlin',
  '.cs': 'csharp',
  '.php': 'php',
  '.swift': 'swift',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
};

function inferLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return LANGUAGE_MAP[ext] ?? 'unknown';
}

interface ParsedFile {
  filePath: string;
  hunks: ChangedHunk[];
}

function parseUnifiedDiff(diffOutput: string): ParsedFile[] {
  const files: ParsedFile[] = [];
  // Split into per-file sections
  const fileSections = diffOutput.split(/^diff --git /m).filter(Boolean);

  for (const section of fileSections) {
    const headerMatch = section.match(/^a\/.+ b\/(.+)$/m);
    if (!headerMatch) continue;
    const filePath = headerMatch[1];

    const hunks: ChangedHunk[] = [];
    const hunkParts = section.split(/^(@@ .+? @@.*$)/m);

    for (let i = 1; i < hunkParts.length; i += 2) {
      const hunkHeader = hunkParts[i];
      const hunkBody = hunkParts[i + 1] ?? '';

      const hunkMatch = hunkHeader.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
      if (!hunkMatch) continue;

      const startLine = parseInt(hunkMatch[1], 10);
      const lines: ChangedLine[] = [];
      let currentLine = startLine;

      for (const rawLine of hunkBody.split('\n')) {
        if (rawLine === '' || rawLine === '\\ No newline at end of file') {
          continue;
        }
        if (rawLine.startsWith('+')) {
          lines.push({
            lineNumber: currentLine,
            content: rawLine.slice(1),
            type: 'added',
          });
          currentLine++;
        } else if (rawLine.startsWith('-')) {
          // Deleted lines don't increment new-file line counter
        } else if (rawLine.startsWith(' ') || rawLine === '') {
          currentLine++;
        }
      }

      if (lines.length > 0) {
        hunks.push({
          startLine: lines[0].lineNumber,
          lineCount: lines.length,
          lines,
        });
      }
    }

    if (hunks.length > 0) {
      files.push({ filePath, hunks });
    }
  }

  return files;
}

function matchesGlobs(filePath: string, patterns: string[]): boolean {
  return patterns.some((p) => minimatch(filePath, p));
}

export function extractDiff(
  baseRef: string,
  include?: string[],
  exclude?: string[],
  excludeTests: boolean = true,
): DiffResult {
  const root = gitRoot();
  const diffOutput = gitDiff(baseRef);

  if (!diffOutput.trim()) {
    return { baseRef, files: [] };
  }

  const parsedFiles = parseUnifiedDiff(diffOutput);

  const files: ChangedFile[] = [];

  for (const parsed of parsedFiles) {
    // Apply include/exclude filters
    if (include && include.length > 0 && !matchesGlobs(parsed.filePath, include)) {
      continue;
    }
    if (exclude && exclude.length > 0 && matchesGlobs(parsed.filePath, exclude)) {
      continue;
    }

    if (excludeTests && isTestFile(parsed.filePath)) {
      continue;
    }

    const language = inferLanguage(parsed.filePath);

    // Skip non-source files (config, lock files, etc.) unless explicitly included
    if (language === 'unknown' && !(include && include.length > 0)) {
      continue;
    }

    const absPath = path.join(root, parsed.filePath);
    if (!fs.existsSync(absPath)) continue;

    const currentContent = fs.readFileSync(absPath, 'utf-8');

    files.push({
      filePath: parsed.filePath,
      currentContent,
      hunks: parsed.hunks,
      language,
    });
  }

  return { baseRef, files };
}
