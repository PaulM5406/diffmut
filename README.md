# diffmut

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

LLM-powered mutation testing for your pull requests.

**diffmut** generates intelligent code mutations using LLMs (OpenAI or Anthropic) on files changed in a PR, then runs your test suite against each mutation to measure how well your tests catch real bugs.

## Installation

```bash
npm install -g @paulm5406/diffmut --registry=https://npm.pkg.github.com
```

## Quick Start

```bash
# Run mutation testing against changes from origin/main
diffmut run --test-command "npm test"

# Use a specific branch as diff base
diffmut run --test-command "pytest" --diff-base main

# Use Anthropic instead of OpenAI
ANTHROPIC_API_KEY=sk-... diffmut run --test-command "npm test" --model claude-sonnet-4-5-20250514

# Generate more mutations per file
diffmut run --test-command "npm test" --mutations 10

# Output as JSON
diffmut run --test-command "npm test" --output json

# Fail CI if any mutation survives
diffmut run --test-command "npm test" --fail-on-survived
```

## Configuration

### CLI Options

| Option | Description | Default |
|---|---|---|
| `--test-command <cmd>` | Shell command to run tests (required) | — |
| `--diff-base <ref>` | Git ref to diff against | `origin/main` |
| `--mutations <n>` | Mutations per changed file | `5` |
| `--model <model>` | LLM model to use | `gpt-4o` |
| `--provider <name>` | `openai` or `anthropic` (auto-detected from model) | — |
| `--timeout <seconds>` | Max time per test run | `300` |
| `--output <format>` | `text`, `json`, or `github` | `text` |
| `--include <glob...>` | Include files matching glob | — |
| `--exclude <glob...>` | Exclude files matching glob | — |
| `--fail-on-survived` | Exit code 2 if any mutation survives | `false` |
| `--dry-run` | Generate mutations without running tests | `false` |
| `--config <path>` | Path to config file | — |

### Config File

Create a `.diffmutrc.json`, `.diffmutrc.yml`, or `.diffmutrc.yaml` in your project root:

```json
{
  "testCommand": "npm test",
  "mutations": 8,
  "model": "gpt-4o",
  "timeout": 120,
  "include": ["src/**/*.ts"],
  "exclude": ["**/*.test.ts"]
}
```

## GitHub Action

Use diffmut directly in your CI pipeline:

```yaml
- uses: PaulM5406/diffmut@v1
  with:
    test-command: 'npm test'
    openai-api-key: ${{ secrets.OPENAI_API_KEY }}
    mutations: '5'
    fail-on-survived: 'true'
```

The action automatically posts a mutation testing report as a PR comment.

### Action Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `test-command` | Yes | — | Shell command to run tests |
| `diff-base` | No | PR base | Git ref to diff against |
| `mutations` | No | `5` | Mutations per changed file |
| `model` | No | `gpt-4o` | LLM model to use |
| `provider` | No | auto | `openai` or `anthropic` |
| `timeout` | No | `300` | Max time per test run (seconds) |
| `include` | No | — | Glob patterns to include |
| `exclude` | No | — | Glob patterns to exclude |
| `fail-on-survived` | No | `false` | Fail if any mutation survives |
| `openai-api-key` | No | — | OpenAI API key |
| `anthropic-api-key` | No | — | Anthropic API key |

### Action Outputs

| Output | Description |
|---|---|
| `mutation-score` | The mutation score as a percentage |
| `report` | The full report in markdown format |

## Providers

### OpenAI (default)

Set the `OPENAI_API_KEY` environment variable. Uses `gpt-4o` by default.

### Anthropic

Set the `ANTHROPIC_API_KEY` environment variable. The provider is auto-detected when using a `claude-*` model name.

```bash
diffmut run --test-command "npm test" --model claude-sonnet-4-5-20250514
```

## How It Works

1. **Diff extraction** — Identifies files changed compared to the base branch
2. **Pre-flight check** — Verifies your test suite passes on the original code
3. **Mutation generation** — Uses an LLM to create realistic, targeted mutations for each changed file
4. **Test execution** — Applies each mutation and runs your test suite
5. **Scoring** — Reports how many mutations were killed (caught) vs survived (missed)

A higher mutation score means your tests are better at catching real bugs.

## License

[MIT](LICENSE)
