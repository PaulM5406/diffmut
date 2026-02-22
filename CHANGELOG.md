# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

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
