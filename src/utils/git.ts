import { execSync } from 'node:child_process';

/**
 * CI-safe environment for git commands.
 *
 * GIT_DISCOVERY_ACROSS_FILESYSTEM — lets git traverse mount boundaries
 * (needed in Docker containers where the workspace is bind-mounted).
 *
 * GIT_CONFIG_* — sets safe.directory=* for the child process only,
 * avoiding "dubious ownership" errors in CI containers.
 */
const GIT_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  GIT_DISCOVERY_ACROSS_FILESYSTEM: '1',
  GIT_CONFIG_COUNT: '1',
  GIT_CONFIG_KEY_0: 'safe.directory',
  GIT_CONFIG_VALUE_0: '*',
};

export function gitDiff(baseRef: string): string {
  return execSync(`git diff ${baseRef}...HEAD --unified=5 --diff-filter=ACM`, {
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
    env: GIT_ENV,
  });
}

export function gitRoot(): string {
  return execSync('git rev-parse --show-toplevel', {
    encoding: 'utf-8',
    env: GIT_ENV,
  }).trim();
}

export function gitCommitMessages(baseRef: string): string {
  try {
    return execSync(`git log ${baseRef}...HEAD --format="%s%n%n%b" --no-merges`, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      env: GIT_ENV,
    }).trim();
  } catch {
    return '';
  }
}

export function isInsideGitRepo(): boolean {
  try {
    execSync('git rev-parse --is-inside-work-tree', {
      encoding: 'utf-8',
      env: GIT_ENV,
    });
    return true;
  } catch {
    return false;
  }
}
