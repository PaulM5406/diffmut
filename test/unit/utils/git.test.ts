import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:child_process', () => ({
  execSync: vi.fn(() => ''),
}));

import { execSync } from 'node:child_process';
import { isInsideGitRepo, gitRoot, gitDiff, gitCommitMessages } from '../../../src/utils/git.js';

const mockedExecSync = vi.mocked(execSync);

function getEnv(): NodeJS.ProcessEnv {
  return (mockedExecSync.mock.calls[0][1] as { env: NodeJS.ProcessEnv }).env;
}

describe('git utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CI-safe environment', () => {
    it('sets GIT_DISCOVERY_ACROSS_FILESYSTEM for container mounts', () => {
      mockedExecSync.mockReturnValue('true\n');
      isInsideGitRepo();
      expect(getEnv().GIT_DISCOVERY_ACROSS_FILESYSTEM).toBe('1');
    });

    it('sets safe.directory=* via GIT_CONFIG env vars', () => {
      mockedExecSync.mockReturnValue('true\n');
      isInsideGitRepo();
      const env = getEnv();
      expect(env.GIT_CONFIG_COUNT).toBe('1');
      expect(env.GIT_CONFIG_KEY_0).toBe('safe.directory');
      expect(env.GIT_CONFIG_VALUE_0).toBe('*');
    });

    it('preserves existing process.env variables', () => {
      mockedExecSync.mockReturnValue('true\n');
      isInsideGitRepo();
      expect(getEnv().PATH).toBe(process.env.PATH);
    });
  });

  describe('isInsideGitRepo', () => {
    it('returns true when inside a git repo', () => {
      mockedExecSync.mockReturnValue('true\n');
      expect(isInsideGitRepo()).toBe(true);
    });

    it('returns false when git command fails', () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error('not a git repo');
      });
      expect(isInsideGitRepo()).toBe(false);
    });
  });

  describe('gitRoot', () => {
    it('returns trimmed repo root path', () => {
      mockedExecSync.mockReturnValue('/repo\n');
      expect(gitRoot()).toBe('/repo');
    });

    it('passes CI-safe env', () => {
      mockedExecSync.mockReturnValue('/repo\n');
      gitRoot();
      expect(getEnv().GIT_DISCOVERY_ACROSS_FILESYSTEM).toBe('1');
    });
  });

  describe('gitDiff', () => {
    it('passes CI-safe env', () => {
      mockedExecSync.mockReturnValue('');
      gitDiff('origin/main');
      expect(getEnv().GIT_DISCOVERY_ACROSS_FILESYSTEM).toBe('1');
    });
  });

  describe('gitCommitMessages', () => {
    it('calls git log with correct format and baseRef', () => {
      mockedExecSync.mockReturnValue('feat: add feature\n\nSome body\n');
      const result = gitCommitMessages('origin/main');
      expect(mockedExecSync).toHaveBeenCalledWith(
        'git log origin/main...HEAD --format="%s%n%n%b" --no-merges',
        expect.objectContaining({ encoding: 'utf-8' }),
      );
      expect(result).toBe('feat: add feature\n\nSome body');
    });

    it('returns empty string on error', () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error('git log failed');
      });
      expect(gitCommitMessages('origin/main')).toBe('');
    });

    it('passes CI-safe env', () => {
      mockedExecSync.mockReturnValue('msg\n');
      gitCommitMessages('origin/main');
      expect(getEnv().GIT_DISCOVERY_ACROSS_FILESYSTEM).toBe('1');
    });
  });
});
