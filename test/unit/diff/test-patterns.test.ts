import { describe, it, expect } from 'vitest';
import { isTestFile, DEFAULT_TEST_EXCLUDE_PATTERNS } from '../../../src/diff/test-patterns.js';

describe('isTestFile', () => {
  describe('JavaScript/TypeScript test files', () => {
    it('should match *.test.ts files', () => {
      expect(isTestFile('src/utils.test.ts')).toBe(true);
    });

    it('should match *.test.js files', () => {
      expect(isTestFile('src/utils.test.js')).toBe(true);
    });

    it('should match *.test.tsx files', () => {
      expect(isTestFile('src/Component.test.tsx')).toBe(true);
    });

    it('should match *.spec.ts files', () => {
      expect(isTestFile('src/utils.spec.ts')).toBe(true);
    });

    it('should match __tests__ directory files', () => {
      expect(isTestFile('src/__tests__/utils.ts')).toBe(true);
    });
  });

  describe('Python test files', () => {
    it('should match test_*.py files', () => {
      expect(isTestFile('test_main.py')).toBe(true);
    });

    it('should match *_test.py files', () => {
      expect(isTestFile('main_test.py')).toBe(true);
    });

    it('should match conftest.py files', () => {
      expect(isTestFile('conftest.py')).toBe(true);
      expect(isTestFile('tests/conftest.py')).toBe(true);
    });

    it('should match files in tests/ directory', () => {
      expect(isTestFile('tests/test_something.py')).toBe(true);
    });
  });

  describe('Go test files', () => {
    it('should match *_test.go files', () => {
      expect(isTestFile('handler_test.go')).toBe(true);
      expect(isTestFile('pkg/handler_test.go')).toBe(true);
    });
  });

  describe('Java test files', () => {
    it('should match *Test.java files', () => {
      expect(isTestFile('src/test/java/MyTest.java')).toBe(true);
    });

    it('should match files in src/test/ directory', () => {
      expect(isTestFile('src/test/java/Helper.java')).toBe(true);
    });
  });

  describe('Ruby test files', () => {
    it('should match *_spec.rb files', () => {
      expect(isTestFile('spec/models/user_spec.rb')).toBe(true);
    });

    it('should match files in spec/ directory', () => {
      expect(isTestFile('spec/helpers/auth.rb')).toBe(true);
    });
  });

  describe('non-test files', () => {
    it('should not match regular source files', () => {
      expect(isTestFile('src/utils.ts')).toBe(false);
      expect(isTestFile('src/main.py')).toBe(false);
      expect(isTestFile('pkg/handler.go')).toBe(false);
      expect(isTestFile('src/main/java/App.java')).toBe(false);
    });

    it('should not match files with test in the name but not matching patterns', () => {
      expect(isTestFile('src/test-utils.ts')).toBe(false);
      expect(isTestFile('src/testing.ts')).toBe(false);
    });
  });

  describe('custom patterns', () => {
    it('should support custom patterns', () => {
      expect(isTestFile('src/foo.custom', ['**/*.custom'])).toBe(true);
      expect(isTestFile('src/foo.ts', ['**/*.custom'])).toBe(false);
    });
  });

  describe('DEFAULT_TEST_EXCLUDE_PATTERNS', () => {
    it('should be a non-empty array', () => {
      expect(DEFAULT_TEST_EXCLUDE_PATTERNS.length).toBeGreaterThan(0);
    });
  });
});
