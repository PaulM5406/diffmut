# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

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
