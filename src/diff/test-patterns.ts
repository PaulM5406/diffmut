import { minimatch } from 'minimatch';

export const DEFAULT_TEST_EXCLUDE_PATTERNS = [
  // JavaScript / TypeScript
  '**/*.test.{ts,js,tsx,jsx}',
  '**/*.spec.{ts,js,tsx,jsx}',
  '**/__tests__/**',
  // Python
  '**/test_*.py',
  '**/*_test.py',
  '**/conftest.py',
  '**/tests/**',
  // Go
  '**/*_test.go',
  // Java
  '**/src/test/**',
  '**/*Test.java',
  // Ruby
  '**/*_spec.rb',
  '**/spec/**',
  // C# / .NET
  '**/*Tests.cs',
  '**/*.Tests/**',
  // Rust
  '**/tests/**',
];

export function isTestFile(
  filePath: string,
  patterns: string[] = DEFAULT_TEST_EXCLUDE_PATTERNS,
): boolean {
  return patterns.some((p) => minimatch(filePath, p));
}
