import { execSync } from 'node:child_process';

export function gitDiff(baseRef: string): string {
  return execSync(`git diff ${baseRef}...HEAD --unified=5 --diff-filter=ACM`, {
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
  });
}

export function gitRoot(): string {
  return execSync('git rev-parse --show-toplevel', {
    encoding: 'utf-8',
  }).trim();
}

export function isInsideGitRepo(): boolean {
  try {
    execSync('git rev-parse --is-inside-work-tree', { encoding: 'utf-8' });
    return true;
  } catch {
    return false;
  }
}
