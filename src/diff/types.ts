export interface ChangedLine {
  lineNumber: number;
  content: string;
  type: 'added' | 'modified';
}

export interface ChangedHunk {
  startLine: number;
  lineCount: number;
  lines: ChangedLine[];
}

export interface ChangedFile {
  filePath: string;
  currentContent: string;
  hunks: ChangedHunk[];
  language: string;
}

export interface DiffResult {
  baseRef: string;
  files: ChangedFile[];
}
