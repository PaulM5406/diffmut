# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [v0.1.0] - 2026-02-23

### Added

- Commit messages fed to the LLM prompt for mutation context, enabling intent-aware mutations
- Function boundary expansion for large truncated files so the LLM sees complete function bodies
- System prompt now instructs the LLM to analyze behavioral invariants before generating mutations

## [v0.0.8] - 2026-02-23

### Fixed

- `action.yml`: `mutation-score` output is now correctly set from the report
- `action.yml`: Shell injection via `eval` replaced with safe bash arrays and env vars
- Per-file token usage now reports actual values instead of always zero
- Config file parse errors now show a descriptive message instead of a raw stack trace
- `FileManager.restoreAll` logs a warning on failure instead of silently swallowing errors
- Anthropic provider now distinguishes "empty response" from "malformed JSON" in warnings

### Changed

- Extracted `createProvider`, `testFileMutations`, `classifyOutcome`, `validateOriginalCode`, `applyMutationToContent`, and `aggregateResults` from `runPipeline` for better testability
- Deduplicated mutation details rendering in GitHub reporter
- Shared `makeFile()` test helper across provider and prompt tests
- `shouldRetry` is now required in `RetryOptions` (no default)

### Removed

- Dead `buildPrompt` single-file function (replaced by `buildMultiFilePrompt`)
- Dead `filterAndMapMutations` single-file function (replaced by `filterAndMapMultiFileMutations`)
- Dead `DEFAULTS` object from config (duplicated Zod schema defaults)
- Dead `isRateLimitError` function from retry utils
- Dead `logger.tokenUsage` accumulator and `addTokenUsage` method
- Dead `'modified'` variant from `ChangedLine.type`

## [v0.0.5] - 2026-02-22

### Changed

- Renamed all "Mutagen" branding to "diffmut" in reports

### Fixed

- Non-source files (config, lock files, CI workflows) are no longer mutated unless explicitly included via `--include`

## [v0.0.4] - 2026-02-22

### Added

- `no_coverage` mutation outcome when no tests are collected (exit code 5)
- Show test output on pre-flight failure for easier debugging

### Fixed

- Pre-flight no longer fails when test command collects zero tests (e.g. `pytest --diff` with no changes)

## [v0.0.3] - 2026-02-21

### Fixed

- Show test output on pre-flight failure for easier debugging

## [v0.0.2] - 2026-02-21

### Fixed

- Git commands failing in Docker/CI containers due to filesystem mount boundaries
- Potential "dubious ownership" errors when repo owner differs from container user

## [v0.0.1] - 2026-02-20

### Added

- LLM-powered mutation generation using OpenAI (GPT-4o) or Anthropic (Claude)
- CLI tool (`diffmut run`) with diff-based mutation testing
- Configuration via CLI options or `.diffmutrc.json` / `.diffmutrc.yml` files
- Multiple output formats: text, JSON, GitHub markdown
- GitHub Action for CI integration with automatic PR comments
- Pre-flight test validation before running mutations
- Glob-based file include/exclude filtering
- Configurable test timeout and mutation count
- `--fail-on-survived` flag for CI gate enforcement
- `--dry-run` mode to preview mutations without running tests
